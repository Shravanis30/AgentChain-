import asyncio
import logging
from typing import Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from backend.db.models import (
    Task, Workflow, WorkflowNode, ExecutionJob, ExecutionWorker, Agent, AgentVersion, Escrow, TaskArtifact, AuditLog, utc_now
)
from backend.orchestrator.queue import queue_service
from backend.agent_engine.llm_providers import llm_provider_factory, UnconfiguredProviderError, LLMProviderError
from backend.orchestrator_service.engine import proof_generator
from backend.blockchain.oracle import oracle_service
from backend.financial.ledger import ledger_service

logger = logging.getLogger("agentchain.worker")

class WorkerDaemonService:
    """Production Worker Service processing leased jobs and coordinating durable workflows."""

    def __init__(self, worker_name: str = "worker-01"):
        self.worker_name = worker_name

    async def register_heartbeat(self, session: AsyncSession, status: str = "READY", current_job_id: Optional[str] = None) -> None:
        """Registers or updates worker heartbeat in execution_workers table."""
        now = utc_now()
        stmt = select(ExecutionWorker).where(ExecutionWorker.worker_name == self.worker_name)
        res = await session.execute(stmt)
        worker = res.scalar_one_or_none()

        if not worker:
            worker = ExecutionWorker(
                worker_name=self.worker_name,
                status=status,
                current_job_id=current_job_id,
                last_heartbeat_at=now
            )
            session.add(worker)
        else:
            worker.status = status
            worker.current_job_id = current_job_id
            worker.last_heartbeat_at = now

        await session.commit()

    async def process_next_job(self, session: AsyncSession) -> bool:
        """
        Attempts to claim and execute the next available job lease.
        Returns True if a job was processed, False if queue was empty.
        """
        await self.register_heartbeat(session, status="READY")

        claim = await queue_service.claim_job_lease(session, self.worker_name)
        if not claim:
            return False

        job, node = claim
        await self.register_heartbeat(session, status="BUSY", current_job_id=job.id)

        try:
            # 1. Fetch Workflow & Task
            stmt_wf = select(Workflow).where(Workflow.id == job.workflow_id)
            res_wf = await session.execute(stmt_wf)
            workflow = res_wf.scalar_one()

            stmt_task = select(Task).where(Task.id == workflow.task_id)
            res_task = await session.execute(stmt_task)
            task = res_task.scalar_one()

            # Check Task Cancellation
            if task.status in ["CANCELLED", "FAILED"]:
                await queue_service.fail_job(session, job.id, f"Task was cancelled or failed (status: {task.status}).", is_terminal=True)
                return True

            # 2. Escrow Funding Pre-condition Guard
            if task.budget_usdc > 0.0:
                stmt_escrow = select(Escrow).where(Escrow.task_id == task.id)
                res_escrow = await session.execute(stmt_escrow)
                escrow = res_escrow.scalar_one_or_none()

                # If escrow is created but unconfirmed, wait for Indexer to observe EscrowLocked event
                if escrow and escrow.status not in ["FUNDED", "SETTLEMENT_PENDING", "SETTLED"]:
                    logger.warning(f"[WORKER] Job {job.id} paused waiting for escrow funding (current escrow status: {escrow.status}).")
                    await queue_service.fail_job(session, job.id, f"Waiting for escrow funding confirmation (status: {escrow.status}).")
                    return True

            # 3. Resolve Exact Pinned Agent Version
            agent_version = await self._resolve_agent_version(session, node, task)

            # 4. Execute LLM Node Call
            provider = llm_provider_factory.get_provider(agent_version.model_provider)
            exec_result = await provider.generate_response(
                system_instructions=agent_version.system_instructions,
                user_prompt=node.input_prompt,
                model_name=agent_version.model_name,
                temperature=float(agent_version.temperature),
                max_tokens=agent_version.max_tokens
            )

            # 5. Mark Job & Node Complete
            await queue_service.complete_job(
                session=session,
                job_id=job.id,
                output_result=exec_result["output_text"],
                tokens_used=exec_result["total_tokens"],
                cost_usdc=exec_result["cost_usdc"]
            )

            # 6. Check Workflow Completion
            await self._check_and_finalize_workflow(session, workflow, task)
            return True

        except UnconfiguredProviderError as upe:
            logger.error(f"[WORKER] Unconfigured provider error on Job {job.id}: {upe}")
            await queue_service.fail_job(session, job.id, str(upe))
            return True
        except Exception as e:
            logger.error(f"[WORKER] Unexpected failure processing Job {job.id}: {e}")
            await queue_service.fail_job(session, job.id, f"Execution failure: {str(e)}")
            return True
        finally:
            await self.register_heartbeat(session, status="READY")

    async def _resolve_agent_version(self, session: AsyncSession, node: WorkflowNode, task: Task) -> AgentVersion:
        """Resolves the exact published agent version pinned to the node or task."""
        if node.agent_version_id:
            stmt = select(AgentVersion).where(AgentVersion.id == node.agent_version_id)
            res = await session.execute(stmt)
            av = res.scalar_one_or_none()
            if av:
                return av

        if task.agent_version_id:
            stmt = select(AgentVersion).where(AgentVersion.id == task.agent_version_id)
            res = await session.execute(stmt)
            av = res.scalar_one_or_none()
            if av:
                return av

        # Resolve published agent matching domain
        stmt = select(Agent).where(Agent.category == node.domain, Agent.status == "PUBLISHED")
        res = await session.execute(stmt)
        agent = res.scalar_one_or_none()

        if agent and agent.versions:
            return agent.versions[-1]

        # General Fallback: Any active published agent
        stmt_any = select(Agent).where(Agent.status == "PUBLISHED")
        res_any = await session.execute(stmt_any)
        any_agent = res_any.scalar_one_or_none()

        if any_agent and any_agent.versions:
            return any_agent.versions[-1]

        raise UnconfiguredProviderError(f"No published agent version available for domain '{node.domain}'. Create and publish an agent first.")

    async def _check_and_finalize_workflow(self, session: AsyncSession, workflow: Workflow, task: Task) -> None:
        """Enqueues ready child nodes and finalizes workflow when all nodes complete."""
        from backend.db.models import WorkflowEdge

        stmt = select(WorkflowNode).where(WorkflowNode.workflow_id == workflow.id)
        res = await session.execute(stmt)
        nodes = res.scalars().all()

        node_dict = {n.id: n for n in nodes}

        # Check for unqueued child nodes whose parents are ALL completed
        stmt_edges = select(WorkflowEdge).where(WorkflowEdge.workflow_id == workflow.id)
        res_edges = await session.execute(stmt_edges)
        edges = res_edges.scalars().all()

        parent_map = {}
        for edge in edges:
            if edge.child_node_id not in parent_map:
                parent_map[edge.child_node_id] = []
            parent_map[edge.child_node_id].append(edge.parent_node_id)

        for n_id, child_node in node_dict.items():
            if child_node.status in ["PENDING", "QUEUED"]:
                parent_ids = parent_map.get(n_id, [])
                if parent_ids and all(node_dict[p_id].status == "COMPLETED" for p_id in parent_ids if p_id in node_dict):
                    # Check if job already enqueued for child_node
                    stmt_job_check = select(ExecutionJob).where(ExecutionJob.node_id == n_id, ExecutionJob.status.in_(["QUEUED", "RUNNING", "COMPLETED"]))
                    res_job_check = await session.execute(stmt_job_check)
                    if not res_job_check.scalar_one_or_none():
                        await queue_service.enqueue_job(session=session, workflow_id=workflow.id, node_id=n_id)

        if any(n.status != "COMPLETED" for n in nodes):
            return # Workflow still in progress

        logger.info(f"[WORKER] All nodes for Workflow {workflow.id} complete. Finalizing Task {task.id}...")

        # 1. Synthesize Output & Artifacts
        outputs = [f"### 🤖 {n.title} ({n.domain.upper()})\n\n{n.output_result}" for n in nodes]
        final_output = "\n\n---\n\n".join(outputs)
        task.final_output = final_output
        task.status = "VERIFYING"
        await session.commit()

        # 2. Cryptographic Proof of Task Generation
        proof_hash = proof_generator.generate_proof_hash(
            task_id=task.id,
            user_prompt=task.user_prompt,
            step_outputs=[n.output_result or "" for n in nodes],
            final_output=final_output
        )
        task.proof_of_task_hash = proof_hash

        # 3. Financial Ledger Settlement (85% Dev / 10% Stakers / 5% DAO)
        task.status = "SETTLING"
        await session.commit()

        primary_agent = None
        for n in nodes:
            if n.agent_id:
                res_ag = await session.execute(select(Agent).where(Agent.id == n.agent_id))
                primary_agent = res_ag.scalar_one_or_none()
                if primary_agent:
                    break

        if not primary_agent:
            res_first = await session.execute(select(Agent).order_by(Agent.created_at.desc()))
            primary_agent = res_first.scalars().first()

        if primary_agent and float(task.budget_usdc) > 0.0:
            await ledger_service.record_task_settlement(
                session=session,
                task_id=task.id,
                developer_id=primary_agent.owner_id,
                gross_amount_usdc=float(task.budget_usdc),
                proof_hash=proof_hash
            )

        try:
            await oracle_service.authorize_and_submit_settlement(
                session=session,
                task_id=task.id,
                execution_result=final_output[:500],
                result_digest=proof_hash
            )
        except Exception as e:
            logger.warning(f"[WORKER] Oracle settlement submission error (non-fatal, local ledger active): {e}")

        # 4. Finalize Task State
        task.status = "COMPLETED"
        task.completed_at = utc_now()
        workflow.status = "COMPLETED"

        session.add(AuditLog(
            actor_id=task.created_by,
            action="TASK_COMPLETED",
            resource_type="task",
            resource_id=task.id,
            details={"proof_of_task_hash": proof_hash}
        ))
        await session.commit()
        logger.info(f"[WORKER] Task {task.id} successfully COMPLETED & SETTLED.")

worker_daemon = WorkerDaemonService()
