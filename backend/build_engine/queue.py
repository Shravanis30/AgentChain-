import logging
from datetime import datetime, timezone, timedelta
from typing import Optional
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.session import AsyncSessionLocal
from backend.db.models import BuildJob, utc_now

logger = logging.getLogger("agentchain.build_queue")

LEASE_DURATION_SECONDS = 300 # 5 minutes build lock

class BuildJobQueue:
    """Durable Build Job Queue backed by PostgreSQL FOR UPDATE SKIP LOCKED row-level locking."""

    @staticmethod
    async def enqueue_build_job(
        agent_id: str,
        agent_version_id: str,
        owner_id: str,
        source_repo: str,
        source_ref: str = "main",
        installation_id: Optional[str] = None
    ) -> BuildJob:
        """Enqueues a new container build job with per-installation isolation."""
        async with AsyncSessionLocal() as session:
            job = BuildJob(
                agent_id=agent_id,
                agent_version_id=agent_version_id,
                owner_id=owner_id,
                installation_id=installation_id,
                source_repo=source_repo,
                source_ref=source_ref,
                status="QUEUED",
                attempts=0
            )
            session.add(job)
            await session.commit()
            await session.refresh(job)
            logger.info(f"[BuildQueue] Enqueued build job {job.id} for agent version {agent_version_id} (Installation: {installation_id})")
            return job

    @staticmethod
    async def acquire_next_job(worker_id: str) -> Optional[BuildJob]:
        """Acquires the next available build job using FOR UPDATE SKIP LOCKED."""
        now = utc_now()

        async with AsyncSessionLocal() as session:
            stmt = (
                select(BuildJob)
                .where(
                    (BuildJob.status == "QUEUED") |
                    ((BuildJob.status == "BUILDING") & (BuildJob.lease_expires_at < now))
                )
                .order_by(BuildJob.created_at.asc())
                .limit(1)
                .with_for_update(skip_locked=True)
            )

            res = await session.execute(stmt)
            job = res.scalar_one_or_none()

            if job:
                job.status = "BUILDING"
                job.lease_worker_id = worker_id
                job.lease_expires_at = now + timedelta(seconds=LEASE_DURATION_SECONDS)
                job.attempts += 1
                await session.commit()
                await session.refresh(job)
                logger.info(f"[BuildQueue] Worker {worker_id} leased build job {job.id}")
                return job

        return None

build_queue = BuildJobQueue()
