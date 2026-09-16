import pytest
from httpx import AsyncClient, ASGITransport
from backend.main import app
from backend.services.exchange_rate import exchange_rate_service, DEFAULT_USDC_INR_RATE


@pytest.mark.asyncio
async def test_get_exchange_rate_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/api/v1/exchange-rate")
    assert response.status_code == 200
    data = response.json()
    assert "usd_to_inr" in data
    assert isinstance(data["usd_to_inr"], (int, float))
    assert data["usd_to_inr"] > 0
    assert "updated_at" in data


@pytest.mark.asyncio
async def test_exchange_rate_service_caching():
    res1 = await exchange_rate_service.get_usd_to_inr_rate()
    assert res1["usd_to_inr"] > 0
    res2 = await exchange_rate_service.get_usd_to_inr_rate()
    assert res2["cached"] is True
    assert res2["usd_to_inr"] == res1["usd_to_inr"]
