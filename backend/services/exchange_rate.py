import logging
import time
from datetime import datetime, timezone
from typing import Dict, Any, Optional
import httpx

logger = logging.getLogger("agentchain.services.exchange_rate")

# Fallback baseline rate if external APIs are completely unreachable
DEFAULT_USDC_INR_RATE = 83.50
CACHE_TTL_SECONDS = 1200  # 20 minutes (within 15-30 minute window)
DISCLAIMER_TEXT = "Settled on-chain in USDC at the live exchange rate — INR is shown for convenience."


class ExchangeRateService:
    """Enterprise service to fetch, cache, and serve USDC to INR exchange rates."""

    def __init__(self):
        self._cached_rate: float = DEFAULT_USDC_INR_RATE
        self._last_fetched_at: float = 0.0
        self._last_updated_iso: str = datetime.now(timezone.utc).isoformat()
        self._is_stale: bool = False
        self._primary_url = (
            "https://api.coingecko.com/api/v3/simple/price?ids=usd-coin&vs_currencies=inr"
        )
        self._fallback_url = "https://open.er-api.com/v6/latest/USD"

    async def _fetch_from_coingecko(self) -> Optional[float]:
        """Attempts to fetch current USDC->INR rate from CoinGecko API."""
        try:
            async with httpx.AsyncClient(timeout=6.0) as client:
                res = await client.get(
                    self._primary_url,
                    headers={"Accept": "application/json", "User-Agent": "AgentChain/2.0"},
                )
                if res.status_code == 200:
                    data = res.json()
                    inr_rate = data.get("usd-coin", {}).get("inr")
                    if inr_rate and isinstance(inr_rate, (int, float)) and inr_rate > 0:
                        return float(inr_rate)
                logger.warning(
                    f"CoinGecko rate fetch returned status {res.status_code}: {res.text[:100]}"
                )
        except Exception as e:
            logger.warning(f"CoinGecko rate fetch failed: {e}")
        return None

    async def _fetch_from_fallback(self) -> Optional[float]:
        """Secondary fallback using open exchange rate API."""
        try:
            async with httpx.AsyncClient(timeout=6.0) as client:
                res = await client.get(self._fallback_url)
                if res.status_code == 200:
                    data = res.json()
                    rates = data.get("rates", {})
                    inr = rates.get("INR")
                    if inr and isinstance(inr, (int, float)) and inr > 0:
                        return float(inr)
        except Exception as e:
            logger.warning(f"Fallback exchange rate fetch failed: {e}")
        return None

    async def get_usd_to_inr_rate(self) -> Dict[str, Any]:
        """Returns the current cached or freshly fetched USDC to INR exchange rate."""
        now = time.time()

        # Serve from cache if still within TTL
        if self._last_fetched_at > 0 and (now - self._last_fetched_at) < CACHE_TTL_SECONDS:
            return {
                "usd_to_inr": self._cached_rate,
                "updated_at": self._last_updated_iso,
                "cached": True,
                "is_stale": self._is_stale,
                "disclaimer": DISCLAIMER_TEXT,
            }

        # Attempt primary source (CoinGecko)
        rate = await self._fetch_from_coingecko()

        # Attempt fallback source if primary failed
        if rate is None:
            rate = await self._fetch_from_fallback()

        if rate is not None:
            self._cached_rate = round(rate, 2)
            self._last_fetched_at = now
            self._last_updated_iso = datetime.now(timezone.utc).isoformat()
            self._is_stale = False
            logger.info(f"Updated USDC->INR rate: {self._cached_rate}")
        else:
            self._is_stale = True
            logger.warning(
                f"All exchange rate sources failed. Using last cached rate: {self._cached_rate} (stale)"
            )

        return {
            "usd_to_inr": self._cached_rate,
            "updated_at": self._last_updated_iso,
            "cached": False if rate is not None else True,
            "is_stale": self._is_stale,
            "disclaimer": DISCLAIMER_TEXT,
        }


exchange_rate_service = ExchangeRateService()
