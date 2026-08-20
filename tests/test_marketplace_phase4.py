import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import select
from fastapi import HTTPException

from backend.db.models import Base, User, Agent, AgentVersion, Task
from backend.db.bootstrap import bootstrap_roles_and_permissions
from backend.routers.marketplace import list_marketplace_agents, get_marketplace_agent_profile, submit_verified_review, PostReviewSchema

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
async def test_marketplace_empty_state_fresh_database(session: AsyncSession):
    # Fresh database listing returns empty agents array
    res = await list_marketplace_agents(session=session)
    assert res["agents"] == []
    assert res["count"] == 0
    assert res["total"] == 0

@pytest.mark.asyncio
async def test_marketplace_returns_only_published_agents(session: AsyncSession):
    user = User(full_name="Dev User")
    session.add(user)
    await session.flush()

    draft_agent = Agent(owner_id=user.id, name="Draft Agent", slug="draft-agent", description="Desc", category="coding", status="DRAFT")
    approved_agent = Agent(owner_id=user.id, name="Approved Agent", slug="approved-agent", description="Desc", category="coding", status="APPROVED")
    published_agent = Agent(owner_id=user.id, name="Published Agent", slug="published-agent", description="Desc", category="coding", status="PUBLISHED")
    session.add_all([draft_agent, approved_agent, published_agent])
    await session.commit()

    res = await list_marketplace_agents(session=session)
    assert res["count"] == 1
    assert res["agents"][0]["name"] == "Published Agent"
    assert res["agents"][0]["slug"] == "published-agent"

@pytest.mark.asyncio
async def test_review_requires_verified_completed_task(session: AsyncSession):
    dev = User(full_name="Agent Owner", email="owner@agentchain.ai")
    buyer = User(full_name="Buyer User", email="buyer@agentchain.ai")
    session.add_all([dev, buyer])
    await session.flush()

    agent = Agent(owner_id=dev.id, name="Code Reviewer", slug="code-reviewer", description="Desc", category="coding", status="PUBLISHED")
    session.add(agent)
    await session.flush()

    # Attempt 1: Owner trying to review own agent MUST fail with 403
    with pytest.raises(HTTPException) as exc_info_owner:
        await submit_verified_review(
            agent_id=agent.id,
            req=PostReviewSchema(rating=5, review_text="Great agent!", task_id="task-dummy"),
            user=dev,
            session=session
        )
    assert exc_info_owner.value.status_code == 403
    assert "cannot submit reviews for their own agents" in str(exc_info_owner.value.detail).lower()

    # Attempt 2: Buyer trying to review without a completed task MUST fail with 400
    with pytest.raises(HTTPException) as exc_info_buyer:
        await submit_verified_review(
            agent_id=agent.id,
            req=PostReviewSchema(rating=5, review_text="Great agent!", task_id="nonexistent-task"),
            user=buyer,
            session=session
        )
    assert exc_info_buyer.value.status_code == 400
    assert "verified purchase required" in str(exc_info_buyer.value.detail).lower()

    # Create COMPLETED task for buyer
    completed_task = Task(id="completed-task-123", created_by=buyer.id, title="Completed Task", user_prompt="Prompt", status="COMPLETED")
    session.add(completed_task)
    await session.commit()

    # Attempt 3: Buyer reviewing with verified COMPLETED task succeeds
    review_res = await submit_verified_review(
        agent_id=agent.id,
        req=PostReviewSchema(rating=5, review_text="Awesome performance!", task_id=completed_task.id),
        user=buyer,
        session=session
    )
    assert review_res["status"] == "success"
    assert review_res["rating"] == 5
