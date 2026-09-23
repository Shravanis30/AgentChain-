import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from eth_account import Account
from backend.blockchain.escrow_client import (
    EscrowClient,
    DEFAULT_AMOY_USDC,
    ESCROW_STATUS_NAMES
)

TEST_PRIVATE_KEY = "0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d"
TEST_DEV_ADDRESS = "0x2222222222222222222222222222222222222222"
TEST_ESCROW_ADDRESS = "0x33b0709B52e782aB9576B6044132E65A3AF5206E"
TEST_USDC_ADDRESS = DEFAULT_AMOY_USDC


def test_escrow_client_conversions():
    client = EscrowClient(escrow_address=TEST_ESCROW_ADDRESS, usdc_address=TEST_USDC_ADDRESS)
    
    # 1.0 USDC -> 1,000,000 micro-units
    assert client.usdc_to_atomic(1.0) == 1_000_000
    assert client.usdc_to_atomic(0.05) == 50_000
    assert client.usdc_to_atomic(14.50) == 14_500_000

    # Task bytes32 conversions
    b32 = client.to_task_bytes32("task_test_123")
    assert len(b32) == 32


def test_build_approve_and_lock_transactions():
    client = EscrowClient(escrow_address=TEST_ESCROW_ADDRESS, usdc_address=TEST_USDC_ADDRESS)
    acct = Account.from_key(TEST_PRIVATE_KEY)

    # Build approve transaction
    approve_tx = client.build_approve_transaction(acct.address, amount_usdc=5.0)
    assert approve_tx["to"] == TEST_USDC_ADDRESS
    assert approve_tx["from"] == acct.address
    assert approve_tx["value"] == 0
    assert len(approve_tx["data"]) > 0

    # Build lock transaction
    lock_tx = client.build_lock_transaction(
        client_address=acct.address,
        task_id="task_12345",
        developer_address=TEST_DEV_ADDRESS,
        amount_usdc=5.0,
        duration_seconds=3600
    )
    assert lock_tx["to"] == TEST_ESCROW_ADDRESS
    assert lock_tx["from"] == acct.address
    assert lock_tx["value"] == 0
    assert len(lock_tx["data"]) > 0


@pytest.mark.asyncio
async def test_lock_fails_without_prior_approval():
    client = EscrowClient(escrow_address=TEST_ESCROW_ADDRESS, usdc_address=TEST_USDC_ADDRESS)
    acct = Account.from_key(TEST_PRIVATE_KEY)

    # Mock allowance to return 0
    with patch.object(client, "get_allowance", new=AsyncMock(return_value=0)):
        with pytest.raises(ValueError) as exc:
            await client.lock_task_escrow(
                account=acct,
                task_id="task_fail",
                developer_address=TEST_DEV_ADDRESS,
                amount_usdc=5.0
            )
        assert "Missing or insufficient ERC-20 approval" in str(exc.value)


@pytest.mark.asyncio
async def test_two_step_deposit_with_approval_flow():
    client = EscrowClient(escrow_address=TEST_ESCROW_ADDRESS, usdc_address=TEST_USDC_ADDRESS)
    acct = Account.from_key(TEST_PRIVATE_KEY)

    # Initial allowance is 0 -> approve called -> lock called
    mock_allowance = AsyncMock(return_value=0)
    mock_approve = AsyncMock(return_value="0xapprove_hash_123")
    mock_lock = AsyncMock(return_value="0xlock_hash_456")

    with patch.object(client, "get_allowance", mock_allowance), \
         patch.object(client, "approve_usdc", mock_approve), \
         patch.object(client, "lock_task_escrow", mock_lock):

        res = await client.deposit_with_approval(
            account=acct,
            task_id="task_success",
            developer_address=TEST_DEV_ADDRESS,
            amount_usdc=10.0
        )

        assert res["task_id"] == "task_success"
        assert res["approve_tx_hash"] == "0xapprove_hash_123"
        assert res["lock_tx_hash"] == "0xlock_hash_456"
        assert res["status"] == "LOCKED"
        mock_approve.assert_awaited_once_with(acct, 10.0)
        mock_lock.assert_awaited_once()
