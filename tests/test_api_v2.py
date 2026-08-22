import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import select

from backend.main import app
from backend.db.models import Base
from backend.db.session import get_db
from backend.db.bootstrap import bootstrap_roles_and_permissions

from sqlalchemy.pool import StaticPool

TEST_DB_URL = "sqlite+aiosqlite:///:memory:"

@pytest_asyncio.fixture
async def test_app_client(monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test-key-for-unit-tests")
    engine = create_async_engine(TEST_DB_URL, poolclass=StaticPool, connect_args={"check_same_thread": False}, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

    # Seed roles
    async with session_factory() as s:
        await bootstrap_roles_and_permissions(s)

    async def override_get_db():
        async with session_factory() as s:
            yield s

    app.dependency_overrides[get_db] = override_get_db

    test_app_client.session_factory = session_factory
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        client.session_factory = session_factory
        yield client

    app.dependency_overrides.clear()
    await engine.dispose()

@pytest.mark.asyncio
async def test_system_health_and_metrics(test_app_client: AsyncClient):
    resp = await test_app_client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "healthy"

    metrics_resp = await test_app_client.get("/metrics")
    assert metrics_resp.status_code == 200
    assert "agentchain_http_requests_total" in metrics_resp.text

@pytest.mark.asyncio
async def test_end_to_end_agent_marketplace_and_task_flow(test_app_client: AsyncClient):
    # 1. Register Developer User
    reg_resp = await test_app_client.post("/api/v1/auth/register", json={
        "email": "dev@agentchain.ai",
        "password": "SuperSecretSecurePassword123!",
        "full_name": "Senior Agent Engineer"
    })
    assert reg_resp.status_code == 200
    dev_token = reg_resp.json()["access_token"]
    dev_headers = {"Authorization": f"Bearer {dev_token}"}

    # 2. Create Agent
    create_agent_resp = await test_app_client.post("/api/v1/agents", headers=dev_headers, json={
        "name": "DeFi Quantitative Analyst",
        "slug": "defi-quantitative-analyst",
        "description": "Analyzes liquidity pool APY and audits smart contract yields",
        "category": "finance",
        "price_per_call_usdc": 0.05,
        "initial_version": {
            "version": "v1.0.0",
            "system_instructions": "You are a quantitative finance specialist modeling token budgets.",
            "model_provider": "openai",
            "model_name": "gpt-4o",
            "temperature": 0.2
        },
        "tool_permissions": [
            {"tool_name": "web_search", "network_enabled": True, "shell_enabled": False}
        ]
    })
    assert create_agent_resp.status_code == 200
    agent_id = create_agent_resp.json()["agent_id"]

    # 3. Validate Agent Security
    val_resp = await test_app_client.post(f"/api/v1/agents/{agent_id}/validate", headers=dev_headers)
    assert val_resp.status_code == 200
    assert val_resp.json()["validation_passed"] is True
    assert val_resp.json()["new_status"] == "VALIDATED"

    # 4. Publish Agent to Marketplace
    pub_resp = await test_app_client.post(f"/api/v1/agents/{agent_id}/publish", headers=dev_headers)
    assert pub_resp.status_code == 200
    assert pub_resp.json()["new_status"] == "PUBLISHED"

    # 5. Search Marketplace
    mkt_resp = await test_app_client.get("/api/v1/marketplace/agents?category=finance")
    assert mkt_resp.status_code == 200
    agents = mkt_resp.json()["agents"]
    assert len(agents) == 1
    assert agents[0]["slug"] == "defi-quantitative-analyst"

    # 6. Submit Swarm Task (asynchronous non-blocking HTTP submission)
    task_resp = await test_app_client.post("/api/v1/tasks/submit", headers=dev_headers, json={
        "title": "Yield Farming Optimization Plan",
        "user_prompt": "Research top DeFi protocols and construct finance yield modeling calculations",
        "budget_usdc": 2.0
    })
    assert task_resp.status_code == 200
    task_data = task_resp.json()
    assert task_data["status"] == "success"
    task_id = task_data["task_id"]

    # Trigger worker daemon execution for all queued DAG jobs against test database
    from backend.orchestrator.worker import worker_daemon
    async with test_app_client.session_factory() as session:
        while await worker_daemon.process_next_job(session):
            pass

    # Fetch completed task details
    detail_resp = await test_app_client.get(f"/api/v1/tasks/{task_id}", headers=dev_headers)
    assert detail_resp.status_code == 200
    t_detail = detail_resp.json()
    assert t_detail["status"] == "COMPLETED"
    assert t_detail["proof_of_task_hash"].startswith("0x")

    # 7. Check Developer Financial Summary (85% of $2.00 = $1.70)
    fin_resp = await test_app_client.get("/api/v1/financial/summary", headers=dev_headers)
    assert fin_resp.status_code == 200
    fin_data = fin_resp.json()
    assert fin_data["available_balance_usdc"] >= 1.70

    # 8. Request Developer Withdrawal
    with_resp = await test_app_client.post("/api/v1/financial/withdraw", headers=dev_headers, json={
        "destination_wallet": "0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
        "amount_usdc": 1.00
    })
    assert with_resp.status_code == 200
    assert with_resp.json()["withdrawal_status"] == "PENDING"

    # 9. Verify Remaining Balance
    fin_after_resp = await test_app_client.get("/api/v1/financial/summary", headers=dev_headers)
    assert fin_after_resp.json()["available_balance_usdc"] == pytest.approx(0.70, 0.01)

@pytest.mark.asyncio
async def test_rbac_unauthorized_rejection(test_app_client: AsyncClient):
    # Register standard user (has USER role, lacks admin:users permission)
    reg_resp = await test_app_client.post("/api/v1/auth/register", json={
        "email": "standard@agentchain.ai",
        "password": "Password123!",
        "full_name": "Standard User"
    })
    user_token = reg_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {user_token}"}

    # Attempt to access admin users endpoint -> Should be 403 Forbidden
    admin_resp = await test_app_client.get("/api/v1/admin/users", headers=headers)
    assert admin_resp.status_code == 403
    assert "Forbidden" in admin_resp.json()["detail"]
