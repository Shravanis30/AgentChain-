import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import select
from fastapi import HTTPException

from backend.db.models import Base, User, Task, Workflow, WorkflowNode, Escrow, ExecutionJob
from backend.db.bootstrap import bootstrap_roles_and_permissions
from backend.routers.tasks import cancel_task
from backend.orchestrator.worker import worker_daemon

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

@pytest_asyncio.fixture
async def session():
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with session_factory() as s:
        await bootstrap_roles_and_permissions(s)
        yield s

    await engine.dispose()

@pytest.mark.asyncio
async def test_cancelled_task_job_execution_denial(session: AsyncSession):
    user = User(full_name="Client")
    session.add(user)
    await session.flush()

    task = Task(created_by=user.id, title="Cancelled Task", user_prompt="Prompt", status="CANCELLED")
    session.add(task)
    await session.flush()

    wf = Workflow(task_id=task.id, created_by=user.id, status="CANCELLED")
    session.add(wf)
    await session.flush()

    node = WorkflowNode(workflow_id=wf.id, step_order=1, domain="coding", title="Code Node", input_prompt="Prompt", status="QUEUED")
    session.add(node)
    await session.flush()

    from backend.orchestrator.queue import queue_service
    job = await queue_service.enqueue_job(session=session, workflow_id=wf.id, node_id=node.id)

    # Worker processing a job for a cancelled task MUST reject execution and fail job
    processed = await worker_daemon.process_next_job(session)
    assert processed is True

    stmt_job = select(ExecutionJob).where(ExecutionJob.id == job.id)
    res_job = await session.execute(stmt_job)
    job_db = res_job.scalar_one()
    assert job_db.status in ["FAILED", "DLQ"]
    assert "cancelled" in job_db.last_error.lower()

@pytest.mark.asyncio
async def test_unfunded_escrow_task_execution_guard(session: AsyncSession):
    user = User(full_name="Client")
    session.add(user)
    await session.flush()

    # Task requiring $10 USDC budget
    task = Task(created_by=user.id, title="Paid Task", user_prompt="Prompt", budget_usdc=10.0, status="QUEUED")
    session.add(task)
    await session.flush()

    escrow = Escrow(task_id=task.id, client_wallet="0x111", developer_wallet="0x222", amount_usdc=10.0, contract_address="0x1234567890123456789012345678901234567890", status="CREATED") # CREATED, not FUNDED yet!
    session.add(escrow)
    await session.commit()

    # Verify task budget is greater than 0 and escrow is unconfirmed
    stmt_escrow = select(Escrow).where(Escrow.task_id == task.id)
    escrow_db = (await session.execute(stmt_escrow)).scalar_one()
    assert escrow_db.status == "CREATED" # Not FUNDED! Task execution will pause until Indexer confirms EscrowLocked.
