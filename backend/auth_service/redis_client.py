import json
import logging
import time
from typing import Optional, Dict, Any
import redis.asyncio as aioredis

from backend.config import settings

logger = logging.getLogger("agentchain.redis")

class RedisService:
    """Enterprise Redis Manager for SIWE nonces, token blacklist, rate limiting, and replay prevention."""

    def __init__(self):
        self._client: Optional[aioredis.Redis] = None
        self._fallback_memory: Dict[str, Dict[str, Any]] = {}
        self._fallback_blacklisted_jtis: Dict[str, float] = {}
        self._fallback_used_signatures: Dict[str, float] = {}

    async def get_client(self) -> Optional[aioredis.Redis]:
        """Lazy initialization of async Redis client."""
        if self._client is None and settings.REDIS_URL:
            try:
                client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
                await client.ping()
                self._client = client
                logger.info("Connected to Redis successfully.")
            except Exception as e:
                logger.warning(f"Could not connect to Redis at {settings.REDIS_URL}: {str(e)}.")
                if settings.ENVIRONMENT == "production":
                    raise RuntimeError("Production failure: Redis is required for SIWE nonce security and rate limiting.")
                self._client = None
        return self._client

    # ---------------------------------------------------------------------------
    # 1. SIWE NONCE LIFECYCLE MANAGEMENT (Atomic single-use)
    # ---------------------------------------------------------------------------
    async def set_nonce(self, nonce: str, metadata: Dict[str, Any], ttl: int = 300) -> None:
        client = await self.get_client()
        key = f"siwe:nonce:{nonce}"
        payload = json.dumps(metadata)

        if client:
            await client.setex(key, ttl, payload)
        else:
            # Fallback for dev/testing environment when Redis daemon is off
            self._fallback_memory[nonce] = {
                "payload": metadata,
                "expires_at": time.time() + ttl
            }

    async def consume_nonce(self, nonce: str) -> Optional[Dict[str, Any]]:
        client = await self.get_client()
        key = f"siwe:nonce:{nonce}"

        if client:
            # GETDEL provides atomic get-and-delete
            val = await client.getdel(key)
            if val:
                try:
                    return json.loads(val)
                except Exception:
                    return {"valid": True}
            return None
        else:
            entry = self._fallback_memory.pop(nonce, None)
            if not entry:
                return None
            if time.time() > entry["expires_at"]:
                return None
            return entry["payload"]

    # ---------------------------------------------------------------------------
    # 2. SIGNATURE REPLAY PROTECTION
    # ---------------------------------------------------------------------------
    async def is_signature_used(self, sig_hash: str) -> bool:
        client = await self.get_client()
        key = f"siwe:sig:{sig_hash}"

        if client:
            return bool(await client.exists(key))
        else:
            expires = self._fallback_used_signatures.get(sig_hash)
            if expires and time.time() < expires:
                return True
            return False

    async def mark_signature_used(self, sig_hash: str, ttl: int = 86400) -> None:
        client = await self.get_client()
        key = f"siwe:sig:{sig_hash}"

        if client:
            await client.setex(key, ttl, "1")
        else:
            self._fallback_used_signatures[sig_hash] = time.time() + ttl

    # ---------------------------------------------------------------------------
    # 3. JWT TOKEN REVOCATION BLACKLIST
    # ---------------------------------------------------------------------------
    async def blacklist_token(self, jti: str, ttl: int = 86400) -> None:
        client = await self.get_client()
        key = f"token:revoked:{jti}"

        if client:
            await client.setex(key, ttl, "1")
        else:
            self._fallback_blacklisted_jtis[jti] = time.time() + ttl

    async def is_token_blacklisted(self, jti: str) -> bool:
        client = await self.get_client()
        key = f"token:revoked:{jti}"

        if client:
            return bool(await client.exists(key))
        else:
            expires = self._fallback_blacklisted_jtis.get(jti)
            if expires and time.time() < expires:
                return True
            return False

    # ---------------------------------------------------------------------------
    # 4. SLIDING WINDOW RATE LIMITER
    # ---------------------------------------------------------------------------
    async def is_rate_limited(self, identifier: str, max_requests: int = 10, window_seconds: int = 60) -> bool:
        client = await self.get_client()
        key = f"rate:{identifier}"

        if client:
            current = await client.incr(key)
            if current == 1:
                await client.expire(key, window_seconds)
            return current > max_requests
        else:
            # Primitive fallback rate limit check for local dev
            now = time.time()
            entry = self._fallback_memory.get(key)
            if not entry or now > entry["expires_at"]:
                self._fallback_memory[key] = {"count": 1, "expires_at": now + window_seconds}
                return False
            else:
                entry["count"] += 1
                return entry["count"] > max_requests

redis_service = RedisService()
