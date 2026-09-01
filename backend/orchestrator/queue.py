import logging
from typing import Optional, Dict, Any, Tuple
from datetime import timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, and_, or_

from backend.db.models import (
    Task, Workflow, WorkflowNode, ExecutionJob, ExecutionWorker, utc_now
)

logger = logging.getLogger("agentchain.queue")

class ExecutionQueueService:
    """Durable job leasing queue backed by PostgreSQL transactional locks."""

    @staticmethod
    async def check_idempotency(session: AsyncSession, idempotency_key: str) -> Optional[Task]:
        """Checks if a task with the specified idempotency key has already been created."""
        if not idempotency_key:
            return None

        stmt = select(Task).where(Task.idempotency_key == idempotency_key)
        res = await session.execute(stmt)
        return res.scalar_one_or_none()

    @staticmethod
    async def enqueue_job(
        session: AsyncSession,
        workflow_id: str,
        node_id: str,
        queue_name: str = "default",
        max_attempts: int = 3
    ) -> ExecutionJob:
        """Enqueues a durable job for node execution."""
        job = ExecutionJob(
            workflow_id=workflow_id,
            node_id=node_id,
            status="QUEUED",
            queue_name=queue_name,
            attempt_count=0,
            max_attempts=max_attempts
        )
        session.add(job)
        await session.flush()
        logger.info(f"[QUEUE] Job {job.id} enqueued for workflow {workflow_id}, node {node_id}")
        return job

    @staticmethod
    async def claim_job_lease(
        session: AsyncSession,
        worker_name: str,
        lease_duration_sec: int = 30
    ) -> Optional[Tuple[ExecutionJob, WorkflowNode]]:
        """
        Atomically leases an available job using FOR UPDATE SKIP LOCKED or atomic status update.
        Reclaims jobs whose leases have expired.
        """
        now = utc_now()
        lease_expiry = now + timedelta(seconds=lease_duration_sec)

        # Query eligible jobs (QUEUED or expired LEASED/RUNNING)
        stmt = select(ExecutionJob).where(
            or_(
                ExecutionJob.status == "QUEUED",
                and_(
                    ExecutionJob.status == "RUNNING",
                    ExecutionJob.lease_expires_at < now
                )
            )
        ).order_by(ExecutionJob.created_at.asc()).limit(1)

        dialect_name = session.bind.dialect.name if session.bind else ""
        if "postgresql" in dialect_name:
            stmt = stmt.with_for_update(skip_locked=True)

        res = await session.execute(stmt)
        job = res.scalar_one_or_none()

        if not job:
            return None

        # Atomic Lease Claim
        job.status = "RUNNING"
        job.lease_owner = worker_name
        job.lease_expires_at = lease_expiry
        job.attempt_count += 1
        job.updated_at = now

        # Fetch associated node
        stmt_node = select(WorkflowNode).where(WorkflowNode.id == job.node_id)
        res_node = await session.execute(stmt_node)
        node = res_node.scalar_one_or_none()

        if node:
            node.status = "RUNNING"
            node.lease_owner = worker_name
            node.lease_expires_at = lease_expiry
            node.attempt_count = job.attempt_count
            node.updated_at = now

        await session.commit()
        logger.info(f"[QUEUE] Worker '{worker_name}' claimed lease on Job {job.id} (Attempt {job.attempt_count}/{job.max_attempts})")
        return job, node

    @staticmethod
    async def complete_job(
        session: AsyncSession,
        job_id: str,
        output_result: str,
        tokens_used: int = 0,
        cost_usdc: float = 0.0
    ) -> None:
        """Marks job and node as COMPLETED."""
        stmt = select(ExecutionJob).where(ExecutionJob.id == job_id)
        res = await session.execute(stmt)
        job = res.scalar_one_or_none()

        if not job:
            return

        now = utc_now()
        job.status = "COMPLETED"
        job.lease_owner = None
        job.lease_expires_at = None
        job.updated_at = now

        stmt_node = select(WorkflowNode).where(WorkflowNode.id == job.node_id)
        res_node = await session.execute(stmt_node)
        node = res_node.scalar_one_or_none()

        if node:
            node.status = "COMPLETED"
            node.output_result = output_result
            node.tokens_used = tokens_used
            node.cost_usdc = cost_usdc
            node.lease_owner = None
            node.lease_expires_at = None
            node.updated_at = now

        await session.commit()
        logger.info(f"[QUEUE] Job {job_id} successfully COMPLETED.")

    @staticmethod
    async def fail_job(
        session: AsyncSession,
        job_id: str,
        error_message: str,
        is_terminal: bool = False
    ) -> None:
        """Handles job failure; routes to Dead-Letter Queue (DLQ) if max attempts exceeded or terminal."""
        stmt = select(ExecutionJob).where(ExecutionJob.id == job_id)
        res = await session.execute(stmt)
        job = res.scalar_one_or_none()

        if not job:
            return

        now = utc_now()
        job.last_error = error_message
        job.lease_owner = None
        job.lease_expires_at = None
        job.updated_at = now

        stmt_node = select(WorkflowNode).where(WorkflowNode.id == job.node_id)
        res_node = await session.execute(stmt_node)
        node = res_node.scalar_one_or_none()

        if is_terminal or job.attempt_count >= job.max_attempts:
            job.status = "FAILED" if is_terminal else "DLQ"
            if node:
                node.status = "FAILED"
                node.error_message = error_message
            logger.error(f"[QUEUE] Job {job_id} marked {job.status}. Error: {error_message}")
        else:
            job.status = "QUEUED" # Re-queued for retry
            if node:
                node.status = "QUEUED"
            logger.warning(f"[QUEUE] Job {job_id} re-queued for retry (Attempt {job.attempt_count}/{job.max_attempts}). Error: {error_message}")

        await session.commit()

queue_service = ExecutionQueueService()
