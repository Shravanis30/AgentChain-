import logging
import asyncio
import hashlib
from typing import Optional, Dict, Any
from web3 import AsyncWeb3
from eth_account import Account
from fastapi import HTTPException, status

from backend.config import settings
from backend.blockchain.provider import provider_service

logger = logging.getLogger("agentchain.blockchain.transaction")

class BlockchainTransactionService:
    """Dedicated Blockchain Transaction Construction, Signing, Gas Estimation & Receipt Polling Service."""

    def __init__(self):
        self.chain_id = settings.CHAIN_ID

    @staticmethod
    def get_oracle_account() -> Optional[Account]:
        """Resolves oracle Account signer from configuration."""
        pk = settings.SETTLEMENT_ORACLE_PRIVATE_KEY
        if not pk:
            return None
        if not pk.startswith("0x"):
            pk = f"0x{pk}"
        try:
            return Account.from_key(pk)
        except Exception as e:
            logger.error(f"Failed to load oracle account from private key: {e}")
            return None

    async def estimate_gas_and_fees(self, tx_dict: Dict[str, Any]) -> Dict[str, Any]:
        """Estimates EIP-1559 gas fees dynamically."""
        w3 = provider_service.get_w3()
        latest_block = await w3.eth.get_block("latest")
        base_fee = latest_block.get("baseFeePerGas", w3.to_wei(30, "gwei"))

        max_priority_fee = w3.to_wei(2, "gwei")
        max_fee = (base_fee * 2) + max_priority_fee

        tx_dict["maxFeePerGas"] = max_fee
        tx_dict["maxPriorityFeePerGas"] = max_priority_fee
        tx_dict["chainId"] = self.chain_id

        try:
            estimated_gas = await w3.eth.estimate_gas(tx_dict)
            tx_dict["gas"] = int(estimated_gas * 1.2) # 20% buffer
        except Exception as e:
            logger.warning(f"Gas estimation failed, using fallback 300,000 limit: {e}")
            tx_dict["gas"] = 300000

        return tx_dict

    async def send_signed_transaction(self, tx_dict: Dict[str, Any], account: Account) -> str:
        """Signs and broadcasts transaction to JSON-RPC node."""
        w3 = provider_service.get_w3()
        nonce = await w3.eth.get_transaction_count(account.address, "pending")
        tx_dict["nonce"] = nonce

        tx_with_fees = await self.estimate_gas_and_fees(tx_dict)
        signed_tx = account.sign_transaction(tx_with_fees)

        tx_hash = await w3.eth.send_raw_transaction(signed_tx.raw_transaction)
        hex_tx_hash = w3.to_hex(tx_hash)
        logger.info(f"Broadcasted transaction {hex_tx_hash} from {account.address}")
        return hex_tx_hash

    async def wait_for_receipt(self, tx_hash: str, timeout_seconds: int = 60) -> Dict[str, Any]:
        """Polls JSON-RPC provider for transaction receipt."""
        w3 = provider_service.get_w3()
        start_time = asyncio.get_event_loop().time()

        while (asyncio.get_event_loop().time() - start_time) < timeout_seconds:
            try:
                receipt = await w3.eth.get_transaction_receipt(tx_hash)
                if receipt is not None:
                    return dict(receipt)
            except Exception:
                pass
            await asyncio.sleep(2.0)

        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail=f"Transaction {tx_hash} confirmation timed out after {timeout_seconds}s."
        )

transaction_service = BlockchainTransactionService()
