import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import select
from fastapi import HTTPException

from backend.db.models import Base, User, Task, Workflow, ExecutionJob
from backend.db.bootstrap import bootstrap_roles_and_permissions
from backend.routers.tasks import submit_multi_agent_task, cancel_task, SubmitTaskSchema

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
async def test_non_blocking_async_task_submission(session: AsyncSession):
    user = User(full_name="Client User", email="client@agentchain.ai")
    session.add(user)
    await session.flush()

    schema = SubmitTaskSchema(
        title="Async Task Submission Test",
        user_prompt="Perform liquidity pool research and smart contract security audit.",
        budget_usdc=1.0
    )

    # Submission returns immediately with task_id in QUEUED status
    res = await submit_multi_agent_task(req=schema, user=user, session=session)
    assert res["status"] == "success"
    assert res["current_status"] == "QUEUED"
    assert "task_id" in res
    assert "workflow_id" in res

    # Verify DB persistence
    stmt = select(Task).where(Task.id == res["task_id"])
    task_db = (await session.execute(stmt)).scalar_one()
    assert task_db.status == "QUEUED"
    assert len(task_db.workflows) == 1

@pytest.mark.asyncio
async def test_idempotency_deduplication_on_task_submission(session: AsyncSession):
    user = User(full_name="Client User", email="client@agentchain.ai")
    session.add(user)
    await session.flush()

    key = "idempotency-key-unique-123"
    schema = SubmitTaskSchema(
        title="Idempotent Task",
        user_prompt="Research yield strategies.",
        budget_usdc=1.0,
        idempotency_key=key
    )

    # First submission
    res1 = await submit_multi_agent_task(req=schema, idempotency_key_header=key, user=user, session=session)
    assert res1["status"] == "success"
    assert res1["is_duplicate"] is False

    # Duplicate submission with same key
    res2 = await submit_multi_agent_task(req=schema, idempotency_key_header=key, user=user, session=session)
    assert res2["status"] == "success"
    assert res2["is_duplicate"] is True
    assert res2["task_id"] == res1["task_id"]

@pytest.mark.asyncio
async def test_task_cancellation_workflow(session: AsyncSession):
    user = User(full_name="Client User", email="client@agentchain.ai")
    session.add(user)
    await session.flush()

    schema = SubmitTaskSchema(
        title="Task to Cancel",
        user_prompt="Cancel this task execution.",
        budget_usdc=1.0
    )

    res = await submit_multi_agent_task(req=schema, user=user, session=session)
    task_id = res["task_id"]

    # Cancel task
    cancel_res = await cancel_task(task_id=task_id, user=user, session=session)
    assert cancel_res["status"] == "success"
    assert cancel_res["new_status"] == "CANCELLED"

    # Verify Task DB status
    stmt = select(Task).where(Task.id == task_id)
    task_db = (await session.execute(stmt)).scalar_one()
    assert task_db.status == "CANCELLED"
    assert task_db.cancelled_at is not None
