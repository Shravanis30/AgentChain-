import asyncio
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Header, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from backend.db.session import get_db
from backend.db.models import (
    Task, TaskStep, TaskArtifact, User, Workflow, WorkflowNode, WorkflowEdge, ExecutionJob, AuditLog, utc_now
)
from backend.auth_service.rbac import get_current_user, require_permission, assert_task_ownership
from backend.orchestrator.dag_builder import dag_builder, DAGValidationError
from backend.orchestrator.queue import queue_service
from backend.orchestrator.worker import worker_daemon

router = APIRouter(prefix="/api/v1/tasks", tags=["Durable AI Orchestration & Tasks"])

class SubmitTaskSchema(BaseModel):
    title: str = Field(..., min_length=3, max_length=255)
    user_prompt: str = Field(..., min_length=5)
    budget_usdc: float = Field(default=1.0, ge=0.01, le=1000.0)
    project_id: Optional[str] = None
    agent_version_id: Optional[str] = None
    idempotency_key: Optional[str] = None

@router.post("/submit", dependencies=[Depends(require_permission("task:create"))])
async def submit_multi_agent_task(
    req: SubmitTaskSchema,
    idempotency_key_header: Optional[str] = Header(None, alias="Idempotency-Key"),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db)
):
    """
    Submits an AI goal task for durable asynchronous orchestration.
    Returns immediately (< 50ms) in QUEUED state without blocking HTTP request on LLM processing.
    """
    header_str = idempotency_key_header if isinstance(idempotency_key_header, str) else None
    effective_idempotency = header_str or req.idempotency_key

    # 1. Idempotency Check
    if effective_idempotency:
        existing_task = await queue_service.check_idempotency(session, effective_idempotency)
        if existing_task:
            return {
                "status": "success",
                "task_id": existing_task.id,
                "current_status": existing_task.status,
                "is_duplicate": True,
                "proof_of_task_hash": existing_task.proof_of_task_hash,
                "final_output": existing_task.final_output
            }

    # 2. Construct & Validate Topological DAG
    dag = dag_builder.construct_dag_from_intent(req.user_prompt)
    nodes_data = dag["nodes"]
    edges_data = dag["edges"]

    # 3. Create Task in QUEUED state
    task = Task(
        title=req.title,
        user_prompt=req.user_prompt,
        created_by=user.id,
        project_id=req.project_id,
        agent_version_id=req.agent_version_id,
        budget_usdc=req.budget_usdc,
        idempotency_key=effective_idempotency,
        status="QUEUED"
    )
    session.add(task)
    await session.flush()

    # 4. Create Workflow & Persist Nodes/Edges
    workflow = Workflow(
        task_id=task.id,
        created_by=user.id,
        status="CREATED",
        idempotency_key=effective_idempotency
    )
    session.add(workflow)
    await session.flush()

    node_map = {}
    for n in nodes_data:
        wf_node = WorkflowNode(
            workflow_id=workflow.id,
            step_order=n["step_order"],
            domain=n["domain"],
            agent_version_id=req.agent_version_id,
            title=n["title"],
            input_prompt=n["input_prompt"],
            status="QUEUED"
        )
        session.add(wf_node)
        await session.flush()
        node_map[n["id"]] = wf_node

        # Maintain legacy TaskStep compatibility
        ts = TaskStep(
            task_id=task.id,
            step_order=n["step_order"],
            title=n["title"],
            domain=n["domain"],
            input_prompt=n["input_prompt"],
            status="PENDING"
        )
        session.add(ts)

    for e in edges_data:
        parent_db = node_map[e["parent_node_id"]]
        child_db = node_map[e["child_node_id"]]
        wf_edge = WorkflowEdge(
            workflow_id=workflow.id,
            parent_node_id=parent_db.id,
            child_node_id=child_db.id
        )
        session.add(wf_edge)

    # 5. Enqueue Initial Executable Jobs (In-Degree = 0)
    # Node 1 is root
    root_node = list(node_map.values())[0]
    await queue_service.enqueue_job(
        session=session,
        workflow_id=workflow.id,
        node_id=root_node.id
    )

    audit = AuditLog(
        actor_id=user.id,
        action="TASK_CREATED",
        resource_type="task",
        resource_id=task.id,
        details={"title": req.title, "budget_usdc": req.budget_usdc}
    )
    session.add(audit)
    await session.commit()

    # 6. Fire background worker task
    from backend.config import settings
    if getattr(settings, "ENVIRONMENT", "") == "testing":
        await worker_daemon.process_next_job(session)
    else:
        asyncio.create_task(_trigger_worker_task(task.id))

    return {
        "status": "success",
        "task_id": task.id,
        "current_status": task.status,
        "workflow_id": workflow.id,
        "total_nodes": len(nodes_data),
        "is_duplicate": False
    }

async def _trigger_worker_task(task_id: str):
    """Background trigger executing enqueued jobs asynchronously without blocking HTTP response."""
    try:
        from backend.db.session import AsyncSessionLocal
        async with AsyncSessionLocal() as session:
            await worker_daemon.process_next_job(session)
    except Exception as e:
        pass

@router.post("/{task_id}/cancel")
async def cancel_task(
    task_id: str,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db)
):
    """Cancels a running or queued task and releases reserved resources."""
    stmt = select(Task).where(Task.id == task_id)
    res = await session.execute(stmt)
    task = res.scalar_one_or_none()

    if not task:
        raise HTTPException(status_code=404, detail="Task not found.")

    user_roles = [ur.role.name for ur in user.user_roles] if hasattr(user, "user_roles") and user.user_roles else []
    assert_task_ownership(task, user, user_roles)

    if task.status in ["COMPLETED", "CANCELLED"]:
        raise HTTPException(status_code=400, detail=f"Task is already in terminal state '{task.status}'.")

    task.status = "CANCELLED"
    task.cancelled_at = utc_now()

    # Update associated workflows and jobs
    stmt_wf = select(Workflow).where(Workflow.task_id == task.id)
    res_wf = await session.execute(stmt_wf)
    workflows = res_wf.scalars().all()

    for wf in workflows:
        wf.status = "CANCELLED"
        for job in wf.jobs:
            if job.status in ["QUEUED", "RUNNING"]:
                job.status = "FAILED"
                job.last_error = "Task cancelled by user."

    session.add(AuditLog(actor_id=user.id, action="TASK_CANCELLED", resource_type="task", resource_id=task.id))
    await session.commit()

    return {"status": "success", "task_id": task.id, "new_status": task.status}

@router.get("/my")
async def list_my_tasks(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db)
):
    """Lists tasks submitted by current user."""
    stmt = select(Task).where(Task.created_by == user.id).order_by(Task.created_at.desc())
    res = await session.execute(stmt)
    tasks = res.scalars().all()
    return [
        {
            "id": t.id,
            "title": t.title,
            "status": t.status,
            "budget_usdc": float(t.budget_usdc),
            "proof_of_task_hash": t.proof_of_task_hash,
            "steps_count": len(t.steps),
            "created_at": t.created_at.isoformat(),
            "completed_at": t.completed_at.isoformat() if t.completed_at else None
        }
        for t in tasks
    ]

@router.get("/{task_id}")
async def get_task_details(
    task_id: str,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db)
):
    """Retrieves full task details, steps, workflow nodes, and final outputs."""
    stmt = select(Task).where(Task.id == task_id)
    res = await session.execute(stmt)
    task = res.scalar_one_or_none()

    if not task:
        raise HTTPException(status_code=404, detail="Task not found.")

    return {
        "id": task.id,
        "title": task.title,
        "user_prompt": task.user_prompt,
        "status": task.status,
        "budget_usdc": float(task.budget_usdc),
        "proof_of_task_hash": task.proof_of_task_hash,
        "final_output": task.final_output,
        "steps": [
            {
                "id": s.id,
                "step_order": s.step_order,
                "domain": s.domain,
                "title": s.title,
                "status": s.status,
                "output_result": s.output_result,
                "tokens_used": s.tokens_used,
                "latency_ms": s.latency_ms
            }
            for s in task.steps
        ],
        "created_at": task.created_at.isoformat(),
        "completed_at": task.completed_at.isoformat() if task.completed_at else None
    }
