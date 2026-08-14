import logging
import asyncio
from typing import Optional, Dict, Any, List
from web3 import AsyncWeb3, AsyncHTTPProvider
from web3.exceptions import Web3Exception

from backend.config import settings

logger = logging.getLogger("agentchain.blockchain.provider")

class BlockchainProviderService:
    """Enterprise Web3 JSON-RPC Provider Service with resilient reconnection and health monitoring."""

    def __init__(self):
        self.rpc_url = settings.POLYGON_RPC_URL
        self.chain_id = settings.CHAIN_ID
        self._w3: Optional[AsyncWeb3] = None

    def get_w3(self) -> AsyncWeb3:
        """Initializes or returns active AsyncWeb3 instance."""
        if self._w3 is None:
            self._w3 = AsyncWeb3(AsyncHTTPProvider(self.rpc_url))
        return self._w3

    async def check_connection(self) -> bool:
        """Verifies JSON-RPC connectivity and matching chain ID."""
        try:
            w3 = self.get_w3()
            is_connected = await w3.is_connected()
            if not is_connected:
                logger.warning(f"Web3 connection failed for RPC URL: {self.rpc_url}")
                return False

            chain_id = await w3.eth.chain_id
            if chain_id != self.chain_id:
                logger.error(f"Chain ID mismatch! Configured: {self.chain_id}, Connected RPC: {chain_id}")
                return False

            return True
        except Exception as e:
            logger.error(f"Error checking Web3 provider health: {e}")
            return False

    async def get_latest_block_number(self) -> int:
        """Retrieves latest block number with retry backoff."""
        w3 = self.get_w3()
        for attempt in range(settings.MAX_RPC_RETRIES):
            try:
                return await w3.eth.block_number
            except Exception as e:
                logger.warning(f"RPC get block_number attempt {attempt + 1} failed: {e}")
                if attempt == settings.MAX_RPC_RETRIES - 1:
                    raise e
                await asyncio.sleep(2 ** attempt)

        raise RuntimeError("Failed to fetch block number from RPC after retries.")

provider_service = BlockchainProviderService()
