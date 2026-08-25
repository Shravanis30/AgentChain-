import pytest
import pytest_asyncio
from datetime import timedelta
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import select

from backend.db.models import Base, User, Task, Workflow, WorkflowNode, ExecutionJob, ExecutionWorker, utc_now
from backend.db.bootstrap import bootstrap_roles_and_permissions
from backend.orchestrator.queue import queue_service
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
async def test_worker_registration_and_heartbeat(session: AsyncSession):
    await worker_daemon.register_heartbeat(session, status="READY")

    stmt = select(ExecutionWorker).where(ExecutionWorker.worker_name == worker_daemon.worker_name)
    res = await session.execute(stmt)
    worker = res.scalar_one_or_none()

    assert worker is not None
    assert worker.status == "READY"

@pytest.mark.asyncio
async def test_atomic_job_leasing_and_lease_expiration_recovery(session: AsyncSession):
    user = User(full_name="Client")
    session.add(user)
    await session.flush()

    task = Task(created_by=user.id, title="Lease Task", user_prompt="Prompt", status="QUEUED")
    session.add(task)
    await session.flush()

    wf = Workflow(task_id=task.id, created_by=user.id, status="CREATED")
    session.add(wf)
    await session.flush()

    node = WorkflowNode(workflow_id=wf.id, step_order=1, domain="coding", title="Code Node", input_prompt="Prompt", status="QUEUED")
    session.add(node)
    await session.flush()

    job = await queue_service.enqueue_job(session=session, workflow_id=wf.id, node_id=node.id)

    # Claim job lease by Worker 1
    claim1 = await queue_service.claim_job_lease(session=session, worker_name="worker-1", lease_duration_sec=30)
    assert claim1 is not None
    leased_job, leased_node = claim1
    assert leased_job.lease_owner == "worker-1"
    assert leased_job.status == "RUNNING"

    # Worker 2 attempting to claim same job while lease is valid MUST receive None
    claim2 = await queue_service.claim_job_lease(session=session, worker_name="worker-2", lease_duration_sec=30)
    assert claim2 is None

    # Simulate Worker 1 crash and lease expiration
    leased_job.lease_expires_at = utc_now() - timedelta(seconds=10)
    await session.commit()

    # Worker 2 can now claim expired lease job!
    claim3 = await queue_service.claim_job_lease(session=session, worker_name="worker-2", lease_duration_sec=30)
    assert claim3 is not None
    reclaimed_job, _ = claim3
    assert reclaimed_job.lease_owner == "worker-2"
    assert reclaimed_job.attempt_count == 2
