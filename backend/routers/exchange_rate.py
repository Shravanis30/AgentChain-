from fastapi import APIRouter
from backend.services.exchange_rate import exchange_rate_service

router = APIRouter(prefix="/api/v1/exchange-rate", tags=["Currency & Exchange Rate"])


@router.get("")
async def get_exchange_rate():
    """Returns the current cached USDC to INR display conversion rate."""
    return await exchange_rate_service.get_usd_to_inr_rate()
