import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import select
from fastapi import HTTPException

from backend.db.models import Base, User, Agent, Role, UserRole
from backend.db.bootstrap import bootstrap_roles_and_permissions
from backend.routers.agents import get_agent_detail, update_agent_draft, publish_agent, UpdateAgentSchema
from backend.routers.admin import approve_agent

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
async def test_idor_agent_update_and_publish_denial(session: AsyncSession):
    owner = User(full_name="Agent Owner", email="owner@agentchain.ai")
    attacker = User(full_name="Attacker User", email="attacker@agentchain.ai")
    session.add_all([owner, attacker])
    await session.flush()

    agent = Agent(owner_id=owner.id, name="Owner Agent", slug="owner-agent", description="Desc", category="coding", status="DRAFT")
    session.add(agent)
    await session.commit()

    # Attacker attempting to update Owner's agent MUST fail with 403 Forbidden
    with pytest.raises(HTTPException) as exc_info_update:
        await update_agent_draft(
            agent_id=agent.id,
            req=UpdateAgentSchema(name="Hacked Name"),
            user=attacker,
            session=session
        )
    assert exc_info_update.value.status_code == 403

    # Attacker attempting to publish Owner's agent MUST fail with 403 Forbidden
    with pytest.raises(HTTPException) as exc_info_pub:
        await publish_agent(agent_id=agent.id, user=attacker, session=session)
    assert exc_info_pub.value.status_code == 403

@pytest.mark.asyncio
async def test_admin_self_approval_conflict_of_interest_denial(session: AsyncSession):
    # User who is BOTH an Agent Owner AND has SUPER_ADMIN role
    admin_owner = User(full_name="Admin Owner", email="adminowner@agentchain.ai")
    session.add(admin_owner)
    await session.flush()

    stmt_role = select(Role).where(Role.name == "SUPER_ADMIN")
    res_role = await session.execute(stmt_role)
    super_admin_role = res_role.scalar_one()
    session.add(UserRole(user_id=admin_owner.id, role_id=super_admin_role.id))
    await session.flush()

    agent = Agent(owner_id=admin_owner.id, name="Admin Owned Agent", slug="admin-owned", description="Desc", category="coding", status="PENDING_REVIEW")
    session.add(agent)
    await session.commit()

    # Admin attempting to approve their OWN agent MUST fail with 403 Forbidden
    with pytest.raises(HTTPException) as exc_info:
        await approve_agent(agent_id=agent.id, admin_user=admin_owner, session=session)
    assert exc_info.value.status_code == 403
    assert "owners cannot approve their own agents" in str(exc_info.value.detail).lower()

@pytest.mark.asyncio
async def test_draft_agent_visibility_protection(session: AsyncSession):
    owner = User(full_name="Agent Owner")
    other_user = User(full_name="Other User")
    session.add_all([owner, other_user])
    await session.flush()

    agent = Agent(owner_id=owner.id, name="Secret Draft Agent", slug="secret-draft", description="Desc", category="coding", status="DRAFT")
    session.add(agent)
    await session.commit()

    # Other user accessing private DRAFT agent MUST fail with 403 Forbidden
    with pytest.raises(HTTPException) as exc_info:
        await get_agent_detail(agent_id=agent.id, user=other_user, session=session)
    assert exc_info.value.status_code == 403
    assert "permission to view this draft agent" in str(exc_info.value.detail).lower()
