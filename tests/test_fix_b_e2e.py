import pytest
from httpx import AsyncClient, ASGITransport
from backend.main import app
from backend.db.session import get_db
from backend.db.models import User, Wallet, Agent, Role, UserRole, utc_now
from backend.db.bootstrap import bootstrap_roles_and_permissions
from backend.auth_service.auth import auth_service
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import uuid

@pytest.mark.asyncio
async def test_fix_b_full_loop_create_validate_publish_and_dropdown():
    """Verifies Fix B: Create agent -> Validate -> Publish with tx_hash -> Verify in My Agents and Marketplace."""
    
    # 1. Setup user & DB session
    async for session in get_db():
        user_id = str(uuid.uuid4())
        user = User(
            id=user_id,
            email=f"developer_{uuid.uuid4().hex[:6]}@agentchain.ai",
            password_hash="argon2_hash_mock",
            full_name="Web3 Agent Developer"
        )
        session.add(user)

        unique_wallet = f"0x{uuid.uuid4().hex}{uuid.uuid4().hex[:8]}"
        wallet = Wallet(
            user_id=user_id,
            address=unique_wallet.lower(),
            chain_id=80002,
            is_primary=True,
            is_verified=True
        )
        session.add(wallet)
        await bootstrap_roles_and_permissions(session)

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
            # 2. Step B1: Create Agent Draft
            slug = f"solidity-auditor-{uuid.uuid4().hex[:6]}"
            create_payload = {
                "name": "Solidity AST Auditor Pro",
                "slug": slug,
                "description": "Scans smart contracts for reentrancy and access control vulnerabilities.",
                "category": "security",
                "price_per_call_usdc": 0.05,
                "pricing_model": "pay_per_call",
                "initial_version": {
                    "version": "v1.0.0",
                    "system_instructions": "You are a Solidity security analysis agent.",
                    "model_provider": "openai",
                    "model_name": "gpt-4o",
                    "temperature": 0.7,
                    "max_tokens": 4096
                },
                "tool_permissions": [
                    {
                        "tool_name": "web_search",
                        "network_enabled": True
                    }
                ]
            }

            res_create = await ac.post("/api/v1/agents", json=create_payload, headers=headers)
            assert res_create.status_code == 200, res_create.text
            agent_id = res_create.json()["agent_id"]
            assert res_create.json()["current_status"] == "DRAFT"

            # 3. Verify Agent appears in My Agents (/api/v1/agents/me)
            res_me = await ac.get("/api/v1/agents/me", headers=headers)
            assert res_me.status_code == 200
            my_agents = res_me.json()
            assert any(a["id"] == agent_id for a in my_agents)

            # 4. Step B1.4: Run Automated Validation
            res_val = await ac.post(f"/api/v1/agents/{agent_id}/validate", headers=headers)
            assert res_val.status_code == 200, res_val.text
            val_data = res_val.json()
            assert val_data["passed"] is True
            assert val_data["new_status"] == "VALIDATED"

            # 5. Step B2: On-Chain Publish
            dummy_tx_hash = "0x" + "a" * 64
            publish_payload = {
                "tx_hash": dummy_tx_hash,
                "block_number": 1849201
            }
            res_pub = await ac.post(f"/api/v1/agents/{agent_id}/publish", json=publish_payload, headers=headers)
            assert res_pub.status_code == 200, res_pub.text
            pub_data = res_pub.json()
            assert pub_data["new_status"] == "PUBLISHED"
            assert pub_data["tx_hash"] == dummy_tx_hash

            # 6. Verify Agent detail includes onchain tx hash
            res_detail = await ac.get(f"/api/v1/agents/{agent_id}", headers=headers)
            assert res_detail.status_code == 200
            detail_data = res_detail.json()
            assert detail_data["status"] == "PUBLISHED"
            assert detail_data["current_version"]["onchain_tx_hash"] == dummy_tx_hash
            assert detail_data["current_version"]["onchain_block_number"] == 1849201

            # 7. Verify Agent appears in Public Marketplace (/api/v1/marketplace/agents)
            res_mkt = await ac.get("/api/v1/marketplace/agents?category=security")
            assert res_mkt.status_code == 200
            mkt_agents = res_mkt.json()["agents"]
            assert any(a["id"] == agent_id for a in mkt_agents)

        break
