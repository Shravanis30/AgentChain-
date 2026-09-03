import pytest
import uuid
from httpx import AsyncClient, ASGITransport
from backend.main import app
from backend.db.session import AsyncSessionLocal
from backend.db.models import User, Role, UserRole
from backend.db.bootstrap import bootstrap_roles_and_permissions
from backend.auth_service.auth import auth_service
from backend.build_engine.worker import build_worker
from backend.build_engine.queue import build_queue
from sqlalchemy import select


@pytest.mark.asyncio
async def test_github_connect_create_repo_backed_agent_and_build_flow():
    """Requirement Verification for Fix C: End-to-end integration test:

    Connect GitHub -> List Repos -> Create REPO_BACKED Agent -> Trigger Build Job -> Build Worker processes (QUEUED -> BUILDING -> SUCCEEDED) -> Query /versions/{version}/build
    """
    # 1. Setup authenticated user with AGENT_OWNER role in isolated DB session
    async with AsyncSessionLocal() as session:
        await bootstrap_roles_and_permissions(session)

        user_id = str(uuid.uuid4())
        user = User(
            id=user_id,
            email=f"developer_{uuid.uuid4().hex[:6]}@agentchain.ai",
            password_hash="mock_hash",
            full_name="E2E Developer"
        )
        session.add(user)

        stmt_role = select(Role).where(Role.name == "AGENT_OWNER")
        res_role = await session.execute(stmt_role)
        role_obj = res_role.scalar_one_or_none()
        if role_obj:
            session.add(UserRole(user_id=user_id, role_id=role_obj.id))

        await session.commit()

    token = auth_service.create_access_token(
        user_id=user_id,
        roles=["AGENT_OWNER"],
        permissions=["agent:create", "agent:publish"]
    )
    headers = {"Authorization": f"Bearer {token}"}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 2. Connect Dev GitHub Account
        conn_res = await ac.post("/api/v1/github/connect-dev", headers=headers)
        assert conn_res.status_code == 200, conn_res.text
        assert conn_res.json()["status"] == "success"

        # 3. Fetch GitHub Repositories
        repos_res = await ac.get("/api/v1/github/repos", headers=headers)
        assert repos_res.status_code == 200, repos_res.text
        repos_data = repos_res.json()
        assert repos_data["connected"] is True
        assert len(repos_data["repos"]) > 0

        selected_repo = repos_data["repos"][0]["full_name"]
        selected_inst_id = repos_data["repos"][0]["installation_id"]

        # 4. Create Repository-Backed AI Agent Draft
        agent_payload = {
            "name": "E2E Sentinel Auditor",
            "slug": f"e2e-sentinel-{uuid.uuid4().hex[:6]}",
            "description": "Repo-backed autonomous smart contract auditor",
            "category": "security",
            "price_per_call_usdc": 0.05,
            "pricing_model": "pay_per_call",
            "initial_version": {
                "version": "v1.0.0",
                "system_instructions": "Audit Solidity contracts",
                "model_provider": "openai",
                "model_name": "gpt-4o",
                "temperature": 0.7,
                "max_tokens": 4096,
                "source_type": "REPO_BACKED",
                "source_repo": selected_repo,
                "source_ref": "main",
                "installation_id": selected_inst_id
            }
        }

        create_res = await ac.post("/api/v1/agents", json=agent_payload, headers=headers)
        assert create_res.status_code in (200, 201), create_res.text
        agent_data = create_res.json()
        agent_id = agent_data["agent_id"]

        # 5. Acquire queued build job & process via build worker
        job = None
        for _ in range(10):
            next_job = await build_queue.acquire_next_job("test-worker-e2e")
            if next_job and next_job.agent_id == agent_id:
                job = next_job
                break
        assert job is not None
        assert job.agent_id == agent_id

        await build_worker.process_build_job(job)

        # 6. Retrieve Live Container Compilation Build Status
        version_id = job.agent_version_id
        build_res = await ac.get(f"/api/v1/agents/{agent_id}/versions/{version_id}/build", headers=headers)
        assert build_res.status_code == 200, build_res.text
        build_info = build_res.json()

        assert build_info["version_id"] == version_id
        assert build_info["status"] == "SUCCEEDED"
        assert "SUCCEEDED" in build_info["build_log"]
