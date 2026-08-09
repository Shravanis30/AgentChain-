import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import select

from backend.db.models import (
    Base, User, Role, Permission, UserRole, Wallet, Session as UserSession,
    Agent, AgentVersion, AgentToolPermission, AgentValidation, AgentReview,
    Project, Task, TaskStep, TaskArtifact, Execution, ExecutionEvent,
    Escrow, Settlement, Transaction, LedgerAccount, LedgerEntry, Withdrawal,
    Dispute, Notification, AuditLog, SecurityEvent
)
from backend.db.bootstrap import bootstrap_roles_and_permissions

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

@pytest_asyncio.fixture
async def async_session():
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with session_factory() as session:
        yield session

    await engine.dispose()

@pytest.mark.asyncio
async def test_bootstrap_roles_and_permissions(async_session: AsyncSession):
    await bootstrap_roles_and_permissions(async_session)

    # Verify roles exist
    roles = (await async_session.execute(select(Role))).scalars().all()
    role_names = {r.name for r in roles}
    assert "SUPER_ADMIN" in role_names
    assert "ADMIN" in role_names
    assert "AGENT_OWNER" in role_names
    assert "USER" in role_names

    # Verify permissions exist
    permissions = (await async_session.execute(select(Permission))).scalars().all()
    perm_names = {p.name for p in permissions}
    assert "agent:create" in perm_names
    assert "task:create" in perm_names
    assert "withdrawal:create" in perm_names
    assert "admin:security" in perm_names

@pytest.mark.asyncio
async def test_user_wallet_and_session_creation(async_session: AsyncSession):
    user = User(
        email="developer@agentchain.ai",
        full_name="Alice Developer",
        is_active=True
    )
    async_session.add(user)
    await async_session.flush()

    wallet = Wallet(
        user_id=user.id,
        address="0x71C7656EC7ab88b098defB751B7401B5f6d8976F".lower(),
        chain_id=137,
        is_primary=True,
        is_verified=True
    )
    async_session.add(wallet)

    session = UserSession(
        user_id=user.id,
        token_hash="hash_abc123",
        auth_method="siwe",
        expires_at=user.created_at
    )
    async_session.add(session)
    await async_session.commit()

    # Query back
    fetched_user = (await async_session.execute(select(User).where(User.id == user.id))).scalar_one()
    assert fetched_user.email == "developer@agentchain.ai"
    assert len(fetched_user.wallets) == 1
    assert fetched_user.wallets[0].address == "0x71c7656ec7ab88b098defb751b7401b5f6d8976f"

@pytest.mark.asyncio
async def test_agent_and_version_creation(async_session: AsyncSession):
    user = User(full_name="Agent Architect")
    async_session.add(user)
    await async_session.flush()

    agent = Agent(
        owner_id=user.id,
        name="Deep Research Specialist",
        slug="deep-research-specialist",
        description="Autonomous paper and web research agent",
        category="research",
        status="APPROVED",
        price_per_call_usdc=0.002
    )
    async_session.add(agent)
    await async_session.flush()

    version = AgentVersion(
        agent_id=agent.id,
        version="v1.0.0",
        system_instructions="You are an expert research assistant.",
        model_provider="openai",
        model_name="gpt-4o",
        temperature=0.2,
        max_tokens=4096
    )
    async_session.add(version)

    tool_perm = AgentToolPermission(
        agent_id=agent.id,
        tool_name="web_search",
        network_enabled=True,
        filesystem_read=False,
        filesystem_write=False,
        shell_enabled=False
    )
    async_session.add(tool_perm)
    await async_session.commit()

    fetched_agent = (await async_session.execute(select(Agent).where(Agent.id == agent.id))).scalar_one()
    assert len(fetched_agent.versions) == 1
    assert fetched_agent.versions[0].version == "v1.0.0"
    assert len(fetched_agent.tool_permissions) == 1
    assert fetched_agent.tool_permissions[0].network_enabled is True
    assert fetched_agent.tool_permissions[0].shell_enabled is False

@pytest.mark.asyncio
async def test_financial_ledger_double_entry(async_session: AsyncSession):
    user = User(full_name="Bob User")
    async_session.add(user)
    await async_session.flush()

    account = LedgerAccount(
        user_id=user.id,
        account_type="DEVELOPER_EARNINGS",
        currency="USDC",
        balance=100.0
    )
    async_session.add(account)
    await async_session.flush()

    entry = LedgerEntry(
        account_id=account.id,
        reference_id="task_12345",
        entry_type="CREDIT",
        amount=85.0,
        balance_after=85.0,
        description="85% Developer revenue payout for task_12345"
    )
    async_session.add(entry)
    await async_session.commit()

    fetched_account = (await async_session.execute(select(LedgerAccount).where(LedgerAccount.id == account.id))).scalar_one()
    assert len(fetched_account.entries) == 1
    assert fetched_account.entries[0].amount == 85.0
