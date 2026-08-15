import logging
import asyncio
import time
from typing import Dict, Any, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from web3 import AsyncWeb3, Web3
from eth_utils import keccak

from backend.config import settings
from backend.db.session import async_session_factory
from backend.db.models import Escrow, IndexerState, AuditLog, utc_now
from backend.blockchain.provider import provider_service
from backend.financial.ledger import ledger_service

logger = logging.getLogger("agentchain.blockchain.indexer")

# Event Signature Hashes (keccak256 of Solidity event signatures)
ESCROW_LOCKED_TOPIC = "0x" + keccak(text="EscrowLocked(bytes32,address,address,uint256,uint256)").hex()
ESCROW_SETTLED_TOPIC = "0x" + keccak(text="EscrowSettled(bytes32,address,bytes32,uint256,uint256,uint256)").hex()
ESCROW_REFUNDED_TOPIC = "0x" + keccak(text="EscrowRefunded(bytes32,address,uint256,string)").hex()
DISPUTE_RAISED_TOPIC = "0x" + keccak(text="DisputeRaised(bytes32,address,string)").hex()
DISPUTE_RESOLVED_TOPIC = "0x" + keccak(text="DisputeResolved(bytes32,uint8,uint256)").hex()

class BlockchainIndexerService:
    """Production Blockchain Event Indexer with Reorg Safety & Two-Phase Settlement Consistency."""

    def __init__(self):
        self.chain_id = settings.CHAIN_ID
        self.contract_address = settings.MARKETPLACE_CONTRACT_ADDRESS.lower()
        self.confirmation_depth = settings.CONFIRMATION_DEPTH
        self.reorg_limit = settings.REORG_LIMIT
        self._running = False
        self._block_hash_cache: Dict[int, str] = {}

    async def get_or_create_indexer_state(self, session: AsyncSession) -> IndexerState:
        """Retrieves or initializes indexer state tracking record in DB."""
        stmt = select(IndexerState).where(
            IndexerState.chain_id == self.chain_id,
            IndexerState.contract_address == self.contract_address
        )
        res = await session.execute(stmt)
        state = res.scalar_one_or_none()

        if not state:
            state = IndexerState(
                chain_id=self.chain_id,
                contract_address=self.contract_address,
                last_processed_block=0
            )
            session.add(state)
            await session.commit()

        return state

    async def process_event_log(self, session: AsyncSession, log: Dict[str, Any]) -> None:
        """Processes an individual contract event log idempotently."""
        topics = log.get("topics", [])
        if not topics:
            return

        topic0 = topics[0].hex() if isinstance(topics[0], bytes) else str(topics[0])
        tx_hash = log.get("transactionHash")
        hex_tx_hash = tx_hash.hex() if isinstance(tx_hash, bytes) else str(tx_hash)
        block_number = int(log.get("blockNumber", 0))

        # Task ID is indexed as topic[1] in Escrow events
        task_id_bytes = topics[1].hex() if len(topics) > 1 and isinstance(topics[1], bytes) else (str(topics[1]) if len(topics) > 1 else None)

        if topic0.lower() == ESCROW_LOCKED_TOPIC.lower():
            logger.info(f"[INDEXER] Event EscrowLocked observed in tx {hex_tx_hash} at block {block_number}")
            if task_id_bytes:
                stmt = select(Escrow).where(Escrow.escrow_identifier == task_id_bytes)
                res = await session.execute(stmt)
                escrow = res.scalar_one_or_none()
                if escrow:
                    escrow.status = "FUNDED"
                    escrow.deposit_tx_hash = hex_tx_hash
                    escrow.deposit_block_number = block_number
                    escrow.funded_at = utc_now()
                    await session.commit()

        elif topic0.lower() == ESCROW_SETTLED_TOPIC.lower():
            logger.info(f"[INDEXER] Event EscrowSettled observed in tx {hex_tx_hash} at block {block_number}")
            if task_id_bytes:
                stmt = select(Escrow).where(Escrow.escrow_identifier == task_id_bytes)
                res = await session.execute(stmt)
                escrow = res.scalar_one_or_none()

                if escrow and escrow.status != "SETTLED":
                    escrow.status = "SETTLED"
                    escrow.settlement_tx_hash = hex_tx_hash
                    escrow.settlement_block_number = block_number
                    escrow.settled_at = utc_now()

                    # Execute Two-Phase Ledger Settlement
                    await ledger_service.record_task_settlement(
                        session=session,
                        task_id=escrow.task_id,
                        developer_id=escrow.agent_owner_id or "dev-system",
                        gross_amount_usdc=escrow.amount_usdc,
                        proof_hash=escrow.escrow_identifier or "verified",
                        agent_id=None
                    )
                    await session.commit()

        elif topic0.lower() == ESCROW_REFUNDED_TOPIC.lower():
            logger.info(f"[INDEXER] Event EscrowRefunded observed in tx {hex_tx_hash} at block {block_number}")
            if task_id_bytes:
                stmt = select(Escrow).where(Escrow.escrow_identifier == task_id_bytes)
                res = await session.execute(stmt)
                escrow = res.scalar_one_or_none()
                if escrow and escrow.status != "REFUNDED":
                    escrow.status = "REFUNDED"
                    escrow.refund_tx_hash = hex_tx_hash
                    escrow.refund_block_number = block_number
                    escrow.refunded_at = utc_now()
                    await session.commit()

    async def scan_blocks(self) -> None:
        """Scans block ranges with confirmation depth and reorg detection."""
        w3 = provider_service.get_w3()
        latest_block = await w3.eth.block_number

        async with async_session_factory() as session:
            state = await self.get_or_create_indexer_state(session)
            start_block = state.last_processed_block + 1
            safe_block = max(0, latest_block - self.confirmation_depth)

            if start_block > safe_block:
                return # Caught up to safe confirmation depth

            end_block = min(safe_block, start_block + 100) # Batch size 100 blocks
            logger.info(f"[INDEXER] Scanning blocks {start_block} to {end_block} (Safe block: {safe_block})")

            # Check Reorg
            if start_block > 0 and start_block - 1 in self._block_hash_cache:
                prev_block = await w3.eth.get_block(start_block - 1)
                prev_hash = prev_block["hash"].hex()
                if prev_hash != self._block_hash_cache[start_block - 1]:
                    logger.warning(f"[INDEXER REORG DETECTED] Block {start_block - 1} hash mismatch! Rolling back...")
                    state.last_processed_block = max(0, start_block - self.reorg_limit)
                    await session.commit()
                    return

            logs = await w3.eth.get_logs({
                "fromBlock": start_block,
                "toBlock": end_block,
                "address": Web3.to_checksum_address(self.contract_address)
            })

            for log in logs:
                await self.process_event_log(session, log)

            state.last_processed_block = end_block
            await session.commit()

            # Cache block hashes
            for block_num in range(start_block, end_block + 1):
                blk = await w3.eth.get_block(block_num)
                self._block_hash_cache[block_num] = blk["hash"].hex()

            # Evict old cache
            min_keep = max(0, end_block - self.reorg_limit)
            self._block_hash_cache = {b: h for b, h in self._block_hash_cache.items() if b >= min_keep}

    async def run_loop(self) -> None:
        """Main indexer background polling loop with exponential backoff on RPC error."""
        self._running = True
        logger.info(f"[INDEXER STARTED] Polling contract {self.contract_address} every {settings.INDEXER_POLL_INTERVAL_SECONDS}s")

        consecutive_errors = 0
        while self._running:
            try:
                await self.scan_blocks()
                consecutive_errors = 0
                await asyncio.sleep(settings.INDEXER_POLL_INTERVAL_SECONDS)
            except Exception as e:
                consecutive_errors += 1
                backoff = min(60, (2 ** consecutive_errors))
                logger.error(f"[INDEXER RPC ERROR] Attempt {consecutive_errors}: {e}. Retrying in {backoff}s...")
                await asyncio.sleep(backoff)

    def stop(self) -> None:
        self._running = False

indexer_service = BlockchainIndexerService()
