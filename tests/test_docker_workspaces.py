import pytest
import uuid
from datetime import datetime, timezone, timedelta
from sqlalchemy import select
from httpx import AsyncClient, ASGITransport

from backend.main import app
from backend.db.session import async_session_factory, init_db
from backend.db.models import User, Agent, WorkspaceContainer, WorkspaceLease, utc_now
from backend.workspaces.docker_client import get_docker_client, is_docker_available
from backend.workspaces.lifecycle import lifecycle_manager, TIER_RESOURCE_LIMITS
from backend.workspaces.poller import workspace_poller
from backend.auth_service.auth import auth_service

@pytest.mark.asyncio
async def test_docker_daemon_connectivity():
    """Verify Docker daemon is reachable via Python SDK and health check passes."""
    available, msg = is_docker_available()
    assert available is True, f"Docker daemon should be reachable: {msg}"

    client = get_docker_client()
    assert client.ping() is True


@pytest.mark.asyncio
async def test_container_lifecycle_provision_inspect_stop():
    """Test provisioning a real container with resource limits, inspecting it, and stopping it."""
    client = get_docker_client()
    ws_id = str(uuid.uuid4())
    agent_id = str(uuid.uuid4())

    # 1. Provision Small tier container
    res = lifecycle_manager.provision_container(
        workspace_id=ws_id,
        agent_id=agent_id,
        resource_tier="SMALL",
        pricing_mode="PER_HOUR",
        rate_usdc=10.0,
    )

    container_id = res["container_id"]
    assert container_id is not None
    assert res["status"] == "RUNNING"
    assert res["ram_usage_mb"] == 512

    try:
        # 2. Verify container exists in Docker
        docker_container = client.containers.get(container_id)
        assert docker_container.status in ("running", "created")

        # Verify H3 security & isolation constraints
        host_config = docker_container.attrs["HostConfig"]
        assert host_config["Privileged"] is False
        assert "no-new-privileges:true" in host_config["SecurityOpt"]
        assert host_config["Memory"] == 512 * 1024 * 1024
        assert host_config["NanoCpus"] == 1_000_000_000

        # 3. Inspect container via lifecycle manager
        insp = lifecycle_manager.inspect_container(container_id)
        assert insp["status"] == "RUNNING"
        assert insp["running"] is True

        # 4. Fetch logs
        logs = lifecycle_manager.get_container_logs(container_id)
        assert "AgentChain Runtime" in logs

    finally:
        # 5. Stop and remove container
        stopped = lifecycle_manager.stop_container(container_id, remove=True)
        assert stopped is True

        # Confirm container is gone
        insp_after = lifecycle_manager.inspect_container(container_id)
        assert insp_after["running"] is False
        assert insp_after.get("not_found") is True or insp_after["status"] == "STOPPED"


@pytest.mark.asyncio
async def test_poller_reconciles_stopped_container():
    """Verify background poller detects when a container exits and updates DB status."""
    await init_db()

    async with async_session_factory() as session:
        # Create test user and agent
        user = User(
            id=str(uuid.uuid4()),
            email=f"poller_test_{uuid.uuid4().hex[:6]}@example.com",
            password_hash="test"
        )
        session.add(user)

        agent = Agent(
            id=str(uuid.uuid4()),
            owner_id=user.id,
            name="Poller Agent",
            slug=f"poller-agent-{uuid.uuid4().hex[:6]}",
            description="Poller test agent",
            category="coding",
            pricing_model="pay_per_call",
            price_per_call_usdc=0.05
        )
        session.add(agent)
        await session.commit()

        # Provision a real container
        ws_id = str(uuid.uuid4())
        container_data = lifecycle_manager.provision_container(
            workspace_id=ws_id,
            agent_id=agent.id,
            resource_tier="SMALL"
        )
        cid = container_data["container_id"]

        ws = WorkspaceContainer(
            id=ws_id,
            owner_id=user.id,
            agent_id=agent.id,
            resource_tier="SMALL",
            pricing_mode="PER_HOUR",
            rate_usdc=10.0,
            status="RUNNING",
            docker_container_id=cid
        )
        session.add(ws)
        await session.commit()

        # Stop container directly via Docker (simulating external exit or crash)
        lifecycle_manager.stop_container(cid, remove=True)

        # Trigger poller
        await workspace_poller.poll_workspaces()

        # Verify DB status was updated to STOPPED
        await session.refresh(ws)
        assert ws.status == "STOPPED"


@pytest.mark.asyncio
async def test_full_workspace_api_flow():
    """Test full HTTP API: POST /workspaces -> GET /workspaces/{id} -> GET logs -> POST stop."""
    await init_db()

    async with async_session_factory() as session:
        user = User(
            id=str(uuid.uuid4()),
            email=f"api_test_{uuid.uuid4().hex[:6]}@example.com",
            password_hash="test"
        )
        session.add(user)

        agent = Agent(
            id=str(uuid.uuid4()),
            owner_id=user.id,
            name="API Agent",
            slug=f"api-agent-{uuid.uuid4().hex[:6]}",
            description="API test agent",
            category="coding",
            pricing_model="pay_per_call",
            price_per_call_usdc=0.05
        )
        session.add(agent)
        await session.commit()

        token = auth_service.create_access_token(user_id=user.id, email=user.email, roles=["USER"], permissions=[])

    transport = ASGITransport(app=app)
    headers = {"Authorization": f"Bearer {token}"}

    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # 1. Deploy workspace
        post_res = await ac.post(
            "/api/v1/workspaces",
            json={
                "agent_id": agent.id,
                "resource_tier": "SMALL",
                "pricing_mode": "PER_HOUR",
                "rate_usdc": 12.0
            },
            headers=headers
        )
        assert post_res.status_code == 201, post_res.text
        data = post_res.json()
        ws_id = data["id"]
        cid = data["docker_container_id"]
        assert cid is not None
        assert data["status"] == "RUNNING"
        assert data["resource_tier"] == "SMALL"

        try:
            # 2. Poll workspace status
            get_res = await ac.get(f"/api/v1/workspaces/{ws_id}", headers=headers)
            assert get_res.status_code == 200
            get_data = get_res.json()
            assert get_data["status"] == "RUNNING"
            assert get_data["docker_container_id"] == cid

            # 3. Query container logs
            logs_res = await ac.get(f"/api/v1/workspaces/{ws_id}/logs", headers=headers)
            assert logs_res.status_code == 200
            assert "AgentChain Runtime" in logs_res.json()["logs"]

            # 4. Stop workspace
            stop_res = await ac.post(f"/api/v1/workspaces/{ws_id}/stop", headers=headers)
            assert stop_res.status_code == 200

            # 5. Verify stopped status
            get_stopped = await ac.get(f"/api/v1/workspaces/{ws_id}", headers=headers)
            assert get_stopped.json()["status"] == "STOPPED"

        finally:
            # Cleanup if not stopped
            lifecycle_manager.stop_container(cid, remove=True)
