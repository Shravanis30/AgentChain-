import logging
import asyncio
from typing import Dict, Any, Optional, Tuple
from eth_utils import keccak
from eth_account import Account
from web3 import AsyncWeb3
from fastapi import HTTPException, status

from backend.config import settings
from backend.blockchain.provider import provider_service
from backend.blockchain.transaction_service import transaction_service

logger = logging.getLogger("agentchain.blockchain.escrow_client")

# Minimal ERC-20 ABI for USDC
ERC20_ABI = [
    {
        "constant": False,
        "inputs": [
            {"name": "_spender", "type": "address"},
            {"name": "_value", "type": "uint256"}
        ],
        "name": "approve",
        "outputs": [{"name": "", "type": "bool"}],
        "payable": False,
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "constant": True,
        "inputs": [
            {"name": "_owner", "type": "address"},
            {"name": "_spender", "type": "address"}
        ],
        "name": "allowance",
        "outputs": [{"name": "", "type": "uint256"}],
        "payable": False,
        "stateMutability": "view",
        "type": "function"
    },
    {
        "constant": True,
        "inputs": [{"name": "_owner", "type": "address"}],
        "name": "balanceOf",
        "outputs": [{"name": "balance", "type": "uint256"}],
        "payable": False,
        "stateMutability": "view",
        "type": "function"
    },
    {
        "constant": True,
        "inputs": [],
        "name": "decimals",
        "outputs": [{"name": "", "type": "uint8"}],
        "payable": False,
        "stateMutability": "view",
        "type": "function"
    }
]

# Minimal ABI for AgentMarketplace / EscrowPayment
ESCROW_ABI = [
    {
        "inputs": [
            {"name": "_taskId", "type": "bytes32"},
            {"name": "_developer", "type": "address"},
            {"name": "_amountUSDC", "type": "uint256"},
            {"name": "_durationSeconds", "type": "uint256"}
        ],
        "name": "lockTaskEscrow",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {"name": "_taskId", "type": "bytes32"},
            {"name": "_proofHash", "type": "bytes32"}
        ],
        "name": "settleTaskEscrow",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [{"name": "_taskId", "type": "bytes32"}],
        "name": "refundExpiredEscrow",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [{"name": "", "type": "bytes32"}],
        "name": "escrows",
        "outputs": [
            {"name": "taskId", "type": "bytes32"},
            {"name": "client", "type": "address"},
            {"name": "developer", "type": "address"},
            {"name": "amountUSDC", "type": "uint256"},
            {"name": "proofHash", "type": "bytes32"},
            {"name": "createdAt", "type": "uint256"},
            {"name": "deadline", "type": "uint256"},
            {"name": "status", "type": "uint8"}
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "devSplitBPS",
        "outputs": [{"name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "stakerSplitBPS",
        "outputs": [{"name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "daoSplitBPS",
        "outputs": [{"name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    }
]

# Polygon Amoy Default Addresses
DEFAULT_AMOY_USDC = "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582"
ESCROW_STATUS_NAMES = {0: "NONE", 1: "LOCKED", 2: "SETTLED", 3: "REFUNDED", 4: "DISPUTED"}


class EscrowClient:
    """Enterprise client managing on-chain ERC-20 approve and escrow lock/settle transactions."""

    def __init__(
        self,
        escrow_address: Optional[str] = None,
        usdc_address: Optional[str] = None
    ):
        self.escrow_address = escrow_address or settings.MARKETPLACE_CONTRACT_ADDRESS
        self.usdc_address = usdc_address or getattr(settings, "USDC_CONTRACT_ADDRESS", DEFAULT_AMOY_USDC)

    def _get_w3(self) -> AsyncWeb3:
        return provider_service.get_w3()

    def get_usdc_contract(self):
        w3 = self._get_w3()
        return w3.eth.contract(address=AsyncWeb3.to_checksum_address(self.usdc_address), abi=ERC20_ABI)

    def get_escrow_contract(self):
        w3 = self._get_w3()
        return w3.eth.contract(address=AsyncWeb3.to_checksum_address(self.escrow_address), abi=ESCROW_ABI)

    @staticmethod
    def to_task_bytes32(task_id: str) -> bytes:
        """Converts task ID string into bytes32 hex or keccak hash."""
        if task_id.startswith("0x") and len(task_id) == 66:
            return bytes.fromhex(task_id[2:])
        return keccak(text=task_id)

    @staticmethod
    def usdc_to_atomic(amount_usdc: float) -> int:
        """Converts human readable USDC (e.g. 1.5) to atomic 6-decimal micro-units (1,500,000)."""
        return int(round(amount_usdc * 1_000_000))

    async def get_allowance(self, owner_address: str, spender_address: Optional[str] = None) -> int:
        """Checks current USDC allowance granted by owner to the escrow contract."""
        spender = spender_address or self.escrow_address
        contract = self.get_usdc_contract()
        return await contract.functions.allowance(
            AsyncWeb3.to_checksum_address(owner_address),
            AsyncWeb3.to_checksum_address(spender)
        ).call()

    async def get_usdc_balance(self, account_address: str) -> int:
        """Checks USDC balance of an address."""
        contract = self.get_usdc_contract()
        return await contract.functions.balanceOf(
            AsyncWeb3.to_checksum_address(account_address)
        ).call()

    def build_approve_transaction(
        self,
        owner_address: str,
        amount_usdc: float,
        spender_address: Optional[str] = None
    ) -> Dict[str, Any]:
        """Prepares raw unsigned ERC-20 approve transaction dict."""
        spender = spender_address or self.escrow_address
        atomic_amount = self.usdc_to_atomic(amount_usdc)
        contract = self.get_usdc_contract()
        data = contract.encode_abi("approve", args=[
            AsyncWeb3.to_checksum_address(spender),
            atomic_amount
        ])
        return {
            "from": AsyncWeb3.to_checksum_address(owner_address),
            "to": AsyncWeb3.to_checksum_address(self.usdc_address),
            "data": data,
            "value": 0
        }

    async def approve_usdc(
        self,
        account: Account,
        amount_usdc: float,
        spender_address: Optional[str] = None
    ) -> str:
        """Step 1 of Escrow: Approves USDC token transfer from client to escrow contract."""
        tx_dict = self.build_approve_transaction(account.address, amount_usdc, spender_address)
        logger.info(f"[ESCROW CLIENT] Submitting USDC approve({amount_usdc} USDC) for {account.address}...")
        tx_hash = await transaction_service.send_signed_transaction(tx_dict, account)
        await transaction_service.wait_for_receipt(tx_hash)
        logger.info(f"[ESCROW CLIENT] Step 1 approve confirmed: {tx_hash}")
        return tx_hash

    def build_lock_transaction(
        self,
        client_address: str,
        task_id: str,
        developer_address: str,
        amount_usdc: float,
        duration_seconds: int = 86400
    ) -> Dict[str, Any]:
        """Prepares raw unsigned lockTaskEscrow transaction dict."""
        task_bytes32 = self.to_task_bytes32(task_id)
        atomic_amount = self.usdc_to_atomic(amount_usdc)
        contract = self.get_escrow_contract()
        data = contract.encode_abi("lockTaskEscrow", args=[
            task_bytes32,
            AsyncWeb3.to_checksum_address(developer_address),
            atomic_amount,
            duration_seconds
        ])
        return {
            "from": AsyncWeb3.to_checksum_address(client_address),
            "to": AsyncWeb3.to_checksum_address(self.escrow_address),
            "data": data,
            "value": 0
        }

    async def lock_task_escrow(
        self,
        account: Account,
        task_id: str,
        developer_address: str,
        amount_usdc: float,
        duration_seconds: int = 86400
    ) -> str:
        """
        Step 2 of Escrow: Locks USDC in escrow contract.
        Pre-condition: Allowance MUST be >= amount_usdc or transaction will revert!
        """
        atomic_amount = self.usdc_to_atomic(amount_usdc)
        current_allowance = await self.get_allowance(account.address)
        if current_allowance < atomic_amount:
            raise ValueError(
                f"Missing or insufficient ERC-20 approval! Current allowance: {current_allowance} micro-USDC, "
                f"Required: {atomic_amount} micro-USDC ({amount_usdc} USDC). "
                f"Client must execute approve() before lockTaskEscrow()."
            )

        tx_dict = self.build_lock_transaction(
            client_address=account.address,
            task_id=task_id,
            developer_address=developer_address,
            amount_usdc=amount_usdc,
            duration_seconds=duration_seconds
        )
        logger.info(f"[ESCROW CLIENT] Submitting lockTaskEscrow({task_id}, {amount_usdc} USDC)...")
        tx_hash = await transaction_service.send_signed_transaction(tx_dict, account)
        await transaction_service.wait_for_receipt(tx_hash)
        logger.info(f"[ESCROW CLIENT] Step 2 lock confirmed: {tx_hash}")
        return tx_hash

    async def deposit_with_approval(
        self,
        account: Account,
        task_id: str,
        developer_address: str,
        amount_usdc: float,
        duration_seconds: int = 86400
    ) -> Dict[str, Any]:
        """
        Executes the resilient two-step escrow deposit flow:
        Step 1: Check allowance -> call approve() if insufficient -> wait for confirmation.
        Step 2: Call lockTaskEscrow() -> wait for confirmation.
        """
        atomic_amount = self.usdc_to_atomic(amount_usdc)
        allowance = await self.get_allowance(account.address)
        approve_tx_hash = None

        if allowance < atomic_amount:
            logger.info(
                f"[ESCROW CLIENT] Allowance {allowance} < required {atomic_amount}. Executing Step 1 (approve)..."
            )
            approve_tx_hash = await self.approve_usdc(account, amount_usdc)
        else:
            logger.info(f"[ESCROW CLIENT] Existing allowance {allowance} >= {atomic_amount}. Skipping Step 1.")

        logger.info("[ESCROW CLIENT] Executing Step 2 (lockTaskEscrow)...")
        lock_tx_hash = await self.lock_task_escrow(
            account=account,
            task_id=task_id,
            developer_address=developer_address,
            amount_usdc=amount_usdc,
            duration_seconds=duration_seconds
        )

        return {
            "task_id": task_id,
            "amount_usdc": amount_usdc,
            "approve_tx_hash": approve_tx_hash,
            "lock_tx_hash": lock_tx_hash,
            "status": "LOCKED"
        }

    async def get_escrow_details(self, task_id: str) -> Dict[str, Any]:
        """Reads escrow state directly from the smart contract."""
        contract = self.get_escrow_contract()
        task_bytes32 = self.to_task_bytes32(task_id)
        res = await contract.functions.escrows(task_bytes32).call()
        status_code = res[7]
        return {
            "task_id_bytes32": "0x" + res[0].hex(),
            "client": res[1],
            "developer": res[2],
            "amount_usdc": res[3] / 1_000_000,
            "amount_usdc_atomic": res[3],
            "proof_hash": "0x" + res[4].hex(),
            "created_at": res[5],
            "deadline": res[6],
            "status_code": status_code,
            "status": ESCROW_STATUS_NAMES.get(status_code, "UNKNOWN")
        }

    async def settle_task_escrow(
        self,
        oracle_account: Account,
        task_id: str,
        proof_hash: str
    ) -> str:
        """Settles an escrow on-chain, automatically triggering the 85/10/5 revenue distribution."""
        task_bytes32 = self.to_task_bytes32(task_id)
        proof_bytes32 = bytes.fromhex(proof_hash[2:]) if proof_hash.startswith("0x") else keccak(text=proof_hash)

        contract = self.get_escrow_contract()
        data = contract.encode_abi("settleTaskEscrow", args=[task_bytes32, proof_bytes32])

        tx_dict = {
            "from": AsyncWeb3.to_checksum_address(oracle_account.address),
            "to": AsyncWeb3.to_checksum_address(self.escrow_address),
            "data": data,
            "value": 0
        }

        logger.info(f"[ESCROW CLIENT] Submitting settleTaskEscrow({task_id})...")
        tx_hash = await transaction_service.send_signed_transaction(tx_dict, oracle_account)
        await transaction_service.wait_for_receipt(tx_hash)
        logger.info(f"[ESCROW CLIENT] Settle transaction confirmed: {tx_hash}")
        return tx_hash

    async def verify_full_cycle(
        self,
        client_account: Account,
        developer_address: str,
        oracle_account: Account,
        task_id: str,
        amount_usdc: float
    ) -> Dict[str, Any]:
        """
        Executes and validates the full 3-step cycle on-chain:
        1. approve(escrow, amount)
        2. lockTaskEscrow(task_id, dev, amount, timeout)
        3. settleTaskEscrow(task_id, proof_hash) -> executes 85/10/5 distribution
        """
        # Step 1 & 2: Deposit and Lock
        deposit_result = await self.deposit_with_approval(
            account=client_account,
            task_id=task_id,
            developer_address=developer_address,
            amount_usdc=amount_usdc
        )

        escrow_after_lock = await self.get_escrow_details(task_id)
        if escrow_after_lock["status"] != "LOCKED":
            raise RuntimeError(f"Escrow lock verification failed: state is {escrow_after_lock['status']}")

        # Step 3: Settle with 85/10/5 distribution
        proof_hash = "0x" + keccak(text=f"verified_proof_{task_id}").hex()
        settle_tx_hash = await self.settle_task_escrow(oracle_account, task_id, proof_hash)

        escrow_after_settle = await self.get_escrow_details(task_id)
        if escrow_after_settle["status"] != "SETTLED":
            raise RuntimeError(f"Escrow settlement verification failed: state is {escrow_after_settle['status']}")

        return {
            "task_id": task_id,
            "amount_usdc": amount_usdc,
            "approve_tx_hash": deposit_result["approve_tx_hash"],
            "lock_tx_hash": deposit_result["lock_tx_hash"],
            "settle_tx_hash": settle_tx_hash,
            "proof_hash": proof_hash,
            "final_status": "SETTLED",
            "revenue_split": "85% Dev / 10% Stakers / 5% DAO"
        }


escrow_client = EscrowClient()
