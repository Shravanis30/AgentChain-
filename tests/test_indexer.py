import pytest
import pytest_asyncio
from eth_utils import keccak
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import select

from backend.db.models import Base, Escrow, IndexerState, Task, User, LedgerAccount, LedgerEntry
from backend.db.bootstrap import bootstrap_roles_and_permissions
from backend.blockchain.indexer import indexer_service, ESCROW_LOCKED_TOPIC, ESCROW_SETTLED_TOPIC, ESCROW_REFUNDED_TOPIC

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
async def test_indexer_state_persistence(session: AsyncSession):
    state = await indexer_service.get_or_create_indexer_state(session)
    assert state is not None
    assert state.last_processed_block == 0

    state.last_processed_block = 150
    await session.commit()

    state_reloaded = await indexer_service.get_or_create_indexer_state(session)
    assert state_reloaded.last_processed_block == 150

@pytest.mark.asyncio
async def test_indexer_process_escrow_locked_event(session: AsyncSession):
    # Setup user & escrow
    user = User(full_name="Client User")
    session.add(user)
    await session.flush()

    task = Task(created_by=user.id, title="Indexer Test Task", user_prompt="Prompt")
    session.add(task)
    await session.flush()

    task_bytes32 = "0x" + keccak(text=task.id).hex()
    escrow = Escrow(
        task_id=task.id,
        client_wallet="0x1111111111111111111111111111111111111111",
        developer_wallet="0x2222222222222222222222222222222222222222",
        amount_usdc=10.0,
        contract_address=indexer_service.contract_address,
        escrow_identifier=task_bytes32,
        status="CREATED"
    )
    session.add(escrow)
    await session.commit()

    # Simulate EscrowLocked event log
    mock_log = {
        "topics": [ESCROW_LOCKED_TOPIC, task_bytes32],
        "transactionHash": "0xabc123def4567890abc123def4567890abc123def4567890abc123def4567890",
        "blockNumber": 10050
    }

    await indexer_service.process_event_log(session, mock_log)

    # Verify state transition to FUNDED
    escrow_updated = (await session.execute(select(Escrow).where(Escrow.id == escrow.id))).scalar_one()
    assert escrow_updated.status == "FUNDED"
    assert escrow_updated.deposit_tx_hash == mock_log["transactionHash"]
    assert escrow_updated.deposit_block_number == 10050

@pytest.mark.asyncio
async def test_indexer_process_escrow_settled_and_two_phase_ledger(session: AsyncSession):
    user = User(full_name="Client User")
    dev = User(full_name="Dev User")
    session.add_all([user, dev])
    await session.flush()

    task = Task(created_by=user.id, title="Settlement Task", user_prompt="Prompt")
    session.add(task)
    await session.flush()

    task_bytes32 = "0x" + keccak(text=task.id).hex()
    escrow = Escrow(
        task_id=task.id,
        buyer_id=user.id,
        agent_owner_id=dev.id,
        client_wallet="0x1111111111111111111111111111111111111111",
        developer_wallet="0x2222222222222222222222222222222222222222",
        amount_usdc=100.0, # 100 USDC
        contract_address=indexer_service.contract_address,
        escrow_identifier=task_bytes32,
        status="SETTLEMENT_PENDING"
    )
    session.add(escrow)
    await session.commit()

    # Simulate EscrowSettled event log
    mock_settle_log = {
        "topics": [ESCROW_SETTLED_TOPIC, task_bytes32],
        "transactionHash": "0x999123def4567890abc123def4567890abc123def4567890abc123def4567890",
        "blockNumber": 10060
    }

    await indexer_service.process_event_log(session, mock_settle_log)

    escrow_settled = (await session.execute(select(Escrow).where(Escrow.id == escrow.id))).scalar_one()
    assert escrow_settled.status == "SETTLED"
    assert escrow_settled.settlement_tx_hash == mock_settle_log["transactionHash"]

    # Verify double-entry ledger entries: 85% dev ($85), 10% staker ($10), 5% dao ($5)
    stmt_dev_acc = select(LedgerAccount).where(LedgerAccount.user_id == dev.id, LedgerAccount.account_type == "DEVELOPER_EARNINGS")
    dev_acc = (await session.execute(stmt_dev_acc)).scalar_one()
    assert dev_acc.balance == 85.0

    stmt_staker_acc = select(LedgerAccount).where(LedgerAccount.user_id == None, LedgerAccount.account_type == "STAKING_POOL")
    staker_acc = (await session.execute(stmt_staker_acc)).scalar_one()
    assert staker_acc.balance == 10.0

    stmt_dao_acc = select(LedgerAccount).where(LedgerAccount.user_id == None, LedgerAccount.account_type == "DAO_TREASURY")
    dao_acc = (await session.execute(stmt_dao_acc)).scalar_one()
    assert dao_acc.balance == 5.0

@pytest.mark.asyncio
async def test_indexer_duplicate_event_replay_prevention(session: AsyncSession):
    user = User(full_name="Client User")
    dev = User(full_name="Dev User")
    session.add_all([user, dev])
    await session.flush()

    task = Task(created_by=user.id, title="Replay Task", user_prompt="Prompt")
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
        status="SETTLEMENT_PENDING"
    )
    session.add(escrow)
    await session.commit()

    mock_settle_log = {
        "topics": [ESCROW_SETTLED_TOPIC, task_bytes32],
        "transactionHash": "0x777123def4567890abc123def4567890abc123def4567890abc123def4567890",
        "blockNumber": 10070
    }

    # First event log processing -> credits $85 to dev
    await indexer_service.process_event_log(session, mock_settle_log)

    # Second processing of identical event log -> MUST NOT double credit
    await indexer_service.process_event_log(session, mock_settle_log)

    stmt_dev_acc = select(LedgerAccount).where(LedgerAccount.user_id == dev.id, LedgerAccount.account_type == "DEVELOPER_EARNINGS")
    dev_acc = (await session.execute(stmt_dev_acc)).scalar_one()
    assert dev_acc.balance == 85.0  # Still 85.0, NOT 170.0!
