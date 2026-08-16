import pytest
import pytest_asyncio
from eth_utils import keccak
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import select
from fastapi import HTTPException

from backend.config import settings
from backend.db.models import Base, Escrow, Task, User, LedgerAccount
from backend.db.bootstrap import bootstrap_roles_and_permissions
from backend.blockchain.oracle import oracle_service
from backend.blockchain.indexer import indexer_service, ESCROW_SETTLED_TOPIC, ESCROW_REFUNDED_TOPIC

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

@pytest_asyncio.fixture
async def session():
    settings.SETTLEMENT_ORACLE_PRIVATE_KEY = "0x1111111111111111111111111111111111111111111111111111111111111111"
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with session_factory() as s:
        await bootstrap_roles_and_permissions(s)
        yield s

    await engine.dispose()

@pytest.mark.asyncio
async def test_settle_refunded_escrow_prevention(session: AsyncSession):
    user = User(full_name="Client")
    session.add(user)
    await session.flush()

    task = Task(created_by=user.id, title="Refunded Task", user_prompt="Prompt")
    session.add(task)
    await session.flush()

    escrow = Escrow(
        task_id=task.id,
        client_wallet="0x1111111111111111111111111111111111111111",
        developer_wallet="0x2222222222222222222222222222222222222222",
        amount_usdc=50.0,
        contract_address=indexer_service.contract_address,
        status="REFUNDED" # Already refunded!
    )
    session.add(escrow)
    await session.commit()

    # Attempting to authorize settlement on REFUNDED escrow MUST raise 400 Bad Request
    with pytest.raises(HTTPException) as exc_info:
        await oracle_service.authorize_and_submit_settlement(
            session=session,
            task_id=task.id,
            execution_result="Result",
            result_digest="0xdigest"
        )
    assert exc_info.value.status_code == 400
    assert "invalid state" in str(exc_info.value.detail).lower()

@pytest.mark.asyncio
async def test_duplicate_settlement_on_already_settled_escrow(session: AsyncSession):
    user = User(full_name="Client")
    dev = User(full_name="Dev")
    session.add_all([user, dev])
    await session.flush()

    task = Task(created_by=user.id, title="Settled Task", user_prompt="Prompt")
    session.add(task)
    await session.flush()

    task_bytes32 = "0x" + keccak(text=task.id).hex()
    escrow = Escrow(
        task_id=task.id,
        buyer_id=user.id,
        agent_owner_id=dev.id,
        client_wallet="0x1111111111111111111111111111111111111111",
        developer_wallet="0x2222222222222222222222222222222222222222",
        amount_usdc=100.0,
        contract_address=indexer_service.contract_address,
        escrow_identifier=task_bytes32,
        status="SETTLED" # Already settled!
    )
    session.add(escrow)
    await session.commit()

    mock_settle_log = {
        "topics": [ESCROW_SETTLED_TOPIC, task_bytes32],
        "transactionHash": "0x555123def4567890abc123def4567890abc123def4567890abc123def4567890",
        "blockNumber": 10080
    }

    # Second processing of settled event log MUST NOT double credit
    await indexer_service.process_event_log(session, mock_settle_log)

    stmt_dev_acc = select(LedgerAccount).where(LedgerAccount.user_id == dev.id, LedgerAccount.account_type == "DEVELOPER_EARNINGS")
    res = await session.execute(stmt_dev_acc)
    dev_acc = res.scalar_one_or_none()
    assert dev_acc is None # Ledger credit was NOT duplicated or triggered on already SETTLED escrow!

@pytest.mark.asyncio
async def test_database_tampering_without_blockchain_event(session: AsyncSession):
    user = User(full_name="Client")
    dev = User(full_name="Dev")
    session.add_all([user, dev])
    await session.flush()

    task = Task(created_by=user.id, title="Tampered Task", user_prompt="Prompt")
    session.add(task)
    await session.flush()

    escrow = Escrow(
        task_id=task.id,
        buyer_id=user.id,
        agent_owner_id=dev.id,
        client_wallet="0x1111111111111111111111111111111111111111",
        developer_wallet="0x2222222222222222222222222222222222222222",
        amount_usdc=100.0,
        contract_address=indexer_service.contract_address,
        status="FUNDED"
    )
    session.add(escrow)
    await session.commit()

    # Direct database modification of status without indexer event
    escrow.status = "SETTLED"
    await session.commit()

    # Check that LedgerAccount balance remains 0.0 (no financial ledger credit occurred)
    stmt_dev_acc = select(LedgerAccount).where(LedgerAccount.user_id == dev.id, LedgerAccount.account_type == "DEVELOPER_EARNINGS")
    res = await session.execute(stmt_dev_acc)
    dev_acc = res.scalar_one_or_none()
    assert dev_acc is None
