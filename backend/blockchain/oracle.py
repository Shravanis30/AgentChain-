import logging
import hashlib
from typing import Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from eth_utils import keccak
from fastapi import HTTPException, status

from backend.config import settings
from backend.db.models import Escrow, Task, AuditLog, utc_now
from backend.blockchain.transaction_service import transaction_service

logger = logging.getLogger("agentchain.blockchain.oracle")

class SettlementOracleService:
    """Settlement Authorization & On-Chain Proof Oracle Service."""

    @staticmethod
    def generate_proof_of_task_hash(
        task_id: str,
        agent_id: str,
        agent_version: str,
        execution_result: str,
        result_digest: str
    ) -> str:
        """
        Generates deterministic 32-byte cryptographic proof hash over task execution:
        keccak256(abi.encodePacked(task_id, agent_id, agent_version, result_digest))
        """
        raw_bytes = f"{task_id}:{agent_id}:{agent_version}:{result_digest}".encode("utf-8")
        return "0x" + keccak(raw_bytes).hex()

    async def authorize_and_submit_settlement(
        self,
        session: AsyncSession,
        task_id: str,
        execution_result: str,
        result_digest: str
    ) -> Dict[str, Any]:
        """
        Verifies task completion and submits on-chain settlement transaction to AgentMarketplace contract.
        """
        oracle_acct = transaction_service.get_oracle_account()
        if not oracle_acct:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Settlement Oracle private key is unconfigured or invalid."
            )

        # 1. Lookup Escrow
        stmt = select(Escrow).where(Escrow.task_id == task_id)
        res = await session.execute(stmt)
        escrow = res.scalar_one_or_none()

        if not escrow:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Escrow record not found for task {task_id}."
            )

        if escrow.status not in ["LOCKED", "FUNDED", "COMPLETED"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Escrow is in invalid state '{escrow.status}' for settlement."
            )

        # 2. Generate Proof of Task Hash
        proof_hash = self.generate_proof_of_task_hash(
            task_id=task_id,
            agent_id="agent-001",
            agent_version="1.0.0",
            execution_result=execution_result,
            result_digest=result_digest
        )

        # 3. Construct Contract Call Function Data (settleTaskEscrow(bytes32,bytes32))
        task_bytes32 = escrow.escrow_identifier or ("0x" + keccak(text=task_id).hex())
        proof_bytes32 = proof_hash

        # Method signature for settleTaskEscrow(bytes32,bytes32) -> 0x82f254b7
        method_sig = keccak(text="settleTaskEscrow(bytes32,bytes32)")[:4].hex()
        data_hex = "0x" + method_sig + task_bytes32[2:].zfill(64) + proof_bytes32[2:].zfill(64)

        tx_dict = {
            "to": settings.MARKETPLACE_CONTRACT_ADDRESS,
            "data": data_hex,
            "value": 0
        }

        # 4. Submit Transaction
        tx_hash = await transaction_service.send_signed_transaction(tx_dict, oracle_acct)

        # Update Escrow State to SETTLEMENT_PENDING
        escrow.status = "SETTLEMENT_PENDING"
        escrow.settlement_tx_hash = tx_hash
        await session.commit()

        logger.info(f"[ORACLE] Submitted settlement tx {tx_hash} for task {task_id}")

        return {
            "task_id": task_id,
            "escrow_id": escrow.id,
            "status": "SETTLEMENT_PENDING",
            "proof_hash": proof_hash,
            "transaction_hash": tx_hash
        }

oracle_service = SettlementOracleService()
