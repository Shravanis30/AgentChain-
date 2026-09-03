import pytest
from httpx import AsyncClient, ASGITransport
from backend.main import app
from backend.db.session import get_db
from backend.db.models import User, GitHubInstallation, Role, UserRole, utc_now
from backend.db.bootstrap import bootstrap_roles_and_permissions
from backend.auth_service.auth import auth_service
from sqlalchemy import select
import uuid

@pytest.mark.asyncio
async def test_github_multitenant_isolation_two_users():
    """Acceptance Test for Fix B2: Two different users with two different installations hit /api/v1/github/repos and get disjoint repo lists."""
    
    async for session in get_db():
        await bootstrap_roles_and_permissions(session)
        
        # 1. Setup User A
        user_a_id = str(uuid.uuid4())
        user_a = User(
            id=user_a_id,
            email=f"user_a_{uuid.uuid4().hex[:6]}@agentchain.ai",
            password_hash="argon2_mock",
            full_name="Alice Developer"
        )
        session.add(user_a)

        inst_a_id = f"inst-a-{uuid.uuid4().hex[:6]}"
        inst_a = GitHubInstallation(
            id=str(uuid.uuid4()),
            user_id=user_a_id,
            installation_id=inst_a_id,
            account_login="alice-org",
            account_type="Organization",
            avatar_url="https://github.com/alice.png"
        )
        session.add(inst_a)

        # 2. Setup User B
        user_b_id = str(uuid.uuid4())
        user_b = User(
            id=user_b_id,
            email=f"user_b_{uuid.uuid4().hex[:6]}@agentchain.ai",
            password_hash="argon2_mock",
            full_name="Bob Developer"
        )
        session.add(user_b)

        inst_b_id = f"inst-b-{uuid.uuid4().hex[:6]}"
        inst_b = GitHubInstallation(
            id=str(uuid.uuid4()),
            user_id=user_b_id,
            installation_id=inst_b_id,
            account_login="bob-personal",
            account_type="User",
            avatar_url="https://github.com/bob.png"
        )
        session.add(inst_b)

        await session.commit()

        token_a = auth_service.create_access_token(user_id=user_a_id, roles=["USER"], permissions=[])
        token_b = auth_service.create_access_token(user_id=user_b_id, roles=["USER"], permissions=[])

        headers_a = {"Authorization": f"Bearer {token_a}"}
        headers_b = {"Authorization": f"Bearer {token_b}"}

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            # 3. Request repos as User A
            res_a = await ac.get("/api/v1/github/repos", headers=headers_a)
            assert res_a.status_code == 200, res_a.text
            data_a = res_a.json()
            assert data_a["connected"] is True
            assert len(data_a["installations"]) == 1
            assert data_a["installations"][0]["account_login"] == "alice-org"

            repos_a = [r["full_name"] for r in data_a["repos"]]
            assert len(repos_a) > 0
            assert all(inst_a_id.replace("-", "")[:8] in repo_name for repo_name in repos_a)

            # 4. Request repos as User B
            res_b = await ac.get("/api/v1/github/repos", headers=headers_b)
            assert res_b.status_code == 200, res_b.text
            data_b = res_b.json()
            assert data_b["connected"] is True
            assert len(data_b["installations"]) == 1
            assert data_b["installations"][0]["account_login"] == "bob-personal"

            repos_b = [r["full_name"] for r in data_b["repos"]]
            assert len(repos_b) > 0
            assert all(inst_b_id.replace("-", "")[:8] in repo_name for repo_name in repos_b)

            # 5. Strict Disjoint Check: User A sees ZERO of User B's repos, User B sees ZERO of User A's repos
            intersection = set(repos_a).intersection(set(repos_b))
            assert len(intersection) == 0, f"Cross-tenant leak detected! Common repos: {intersection}"

            # 6. Verify User C (unconnected user) gets connected: false
            user_c_id = str(uuid.uuid4())
            user_c = User(id=user_c_id, email=f"user_c_{uuid.uuid4().hex[:6]}@agentchain.ai", password_hash="mock", full_name="Charlie")
            session.add(user_c)
            await session.commit()
            token_c = auth_service.create_access_token(user_id=user_c_id, roles=["USER"], permissions=[])
            
            res_c = await ac.get("/api/v1/github/repos", headers={"Authorization": f"Bearer {token_c}"})
            assert res_c.status_code == 200
            data_c = res_c.json()
            assert data_c["connected"] is False
            assert len(data_c["repos"]) == 0

        break
