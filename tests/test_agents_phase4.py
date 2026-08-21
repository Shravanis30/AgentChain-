import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import select
from fastapi import HTTPException

from backend.db.models import Base, User, Agent, AgentVersion, AgentValidation
from backend.db.bootstrap import bootstrap_roles_and_permissions
from backend.routers.agents import create_agent, validate_agent, submit_agent_for_review, publish_agent, CreateAgentSchema, CreateAgentVersionSchema

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
async def test_agent_creation_and_version_initialization(session: AsyncSession):
    user = User(full_name="Agent Developer", email="dev@agentchain.ai")
    session.add(user)
    await session.flush()

    schema = CreateAgentSchema(
        name="Security Auditor Agent",
        slug="security-auditor-v1",
        description="Automated security auditing agent.",
        category="security",
        price_per_call_usdc=0.05,
        initial_version=CreateAgentVersionSchema(
            version="v1.0.0",
            system_instructions="Analyze smart contracts for security vulnerabilities.",
            model_provider="openai",
            model_name="gpt-4o"
        )
    )

    res = await create_agent(req=schema, user=user, session=session)
    assert res["status"] == "success"
    assert res["current_status"] == "DRAFT"
    assert res["version"] == "v1.0.0"

    # Verify DB persistence
    stmt = select(Agent).where(Agent.id == res["agent_id"])
    agent_db = (await session.execute(stmt)).scalar_one()
    assert agent_db.owner_id == user.id
    assert len(agent_db.versions) == 1
    assert agent_db.versions[0].version == "v1.0.0"

@pytest.mark.asyncio
async def test_agent_validation_persistence_and_state_transition(session: AsyncSession):
    user = User(full_name="Agent Developer", email="dev@agentchain.ai")
    session.add(user)
    await session.flush()

    schema = CreateAgentSchema(
        name="Research Assistant",
        slug="research-assistant-v1",
        description="Gathers academic papers.",
        category="research",
        price_per_call_usdc=0.01,
        initial_version=CreateAgentVersionSchema(
            version="v1.0.0",
            system_instructions="Perform unbiased literature reviews.",
            model_provider="openai",
            model_name="gpt-4o"
        )
    )

    create_res = await create_agent(req=schema, user=user, session=session)
    agent_id = create_res["agent_id"]

    # Run validation
    val_res = await validate_agent(agent_id=agent_id, user=user, session=session)
    assert val_res["status"] == "success"
    assert val_res["passed"] is True
    assert val_res["new_agent_status"] == "VALIDATED"

    # Verify AgentValidation record in DB
    stmt_val = select(AgentValidation).where(AgentValidation.agent_id == agent_id)
    val_db = (await session.execute(stmt_val)).scalar_one()
    assert val_db.passed is True
    assert val_db.version == "v1.0.0"

@pytest.mark.asyncio
async def test_agent_unvalidated_submission_denial(session: AsyncSession):
    user = User(full_name="Agent Developer", email="dev@agentchain.ai")
    session.add(user)
    await session.flush()

    schema = CreateAgentSchema(
        name="Draft Agent",
        slug="draft-agent-v1",
        description="Unvalidated draft agent.",
        category="general",
        price_per_call_usdc=0.01,
        initial_version=CreateAgentVersionSchema(
            version="v1.0.0",
            system_instructions="Draft instructions.",
            model_provider="openai",
            model_name="gpt-4o"
        )
    )

    create_res = await create_agent(req=schema, user=user, session=session)
    agent_id = create_res["agent_id"]

    # Attempting to submit DRAFT agent without validation MUST fail with 400
    with pytest.raises(HTTPException) as exc_info:
        await submit_agent_for_review(agent_id=agent_id, user=user, session=session)
    assert exc_info.value.status_code == 400
    assert "run validation first" in str(exc_info.value.detail).lower()
