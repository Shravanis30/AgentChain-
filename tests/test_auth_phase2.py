import pytest
import pytest_asyncio
import hashlib
import time
from datetime import datetime, timedelta, timezone
from eth_account import Account
from eth_account.messages import encode_defunct
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import select
from fastapi import HTTPException

from backend.config import settings
from backend.db.models import Base, User, Wallet, Session as UserSession, Task, Agent, Role, UserRole
from backend.db.bootstrap import bootstrap_roles_and_permissions
from backend.auth_service.auth import auth_service
from backend.auth_service.wallet import wallet_service
from backend.auth_service.redis_client import redis_service
from backend.auth_service.rbac import assert_task_ownership, assert_agent_ownership
from backend.cli.bootstrap_admin import run_bootstrap

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

@pytest_asyncio.fixture
async def session():
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with session_factory() as s:
        await bootstrap_roles_and_permissions(s)
        yield s

    await engine.dispose()

@pytest.fixture
def eth_wallet():
    return Account.create()

@pytest.fixture
def eth_wallet_2():
    return Account.create()

# ---------------------------------------------------------------------------
# 1. NONCE LIFECYCLE & REPLAY ATTACK DEFENSES
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_siwe_nonce_single_use():
    nonce = await auth_service.generate_siwe_nonce()
    assert nonce is not None

    # First consumption succeeds
    consumed = await auth_service.consume_siwe_nonce(nonce)
    assert consumed is not None

    # Second consumption fails
    consumed_again = await auth_service.consume_siwe_nonce(nonce)
    assert consumed_again is None

@pytest.mark.asyncio
async def test_siwe_replay_attack_prevention(session: AsyncSession, eth_wallet):
    nonce = await auth_service.generate_siwe_nonce(eth_wallet.address)
    wallet_address = eth_wallet.address

    msg = (
        f"agentchain.ai wants you to sign in with your Ethereum account:\n"
        f"{wallet_address}\n\n"
        f"Sign in with Ethereum.\n\n"
        f"URI: https://agentchain.ai\n"
        f"Version: 1\n"
        f"Chain ID: 137\n"
        f"Nonce: {nonce}\n"
        f"Issued At: 2026-08-31T12:00:00Z"
    )

    signable = encode_defunct(text=msg)
    signed = Account.sign_message(signable, private_key=eth_wallet.key)
    signature = signed.signature.hex()

    # First login succeeds
    res = await auth_service.authenticate_wallet(
        session=session,
        wallet_address=wallet_address,
        message=msg,
        signature=signature
    )
    assert res["access_token"] is not None

    # Attempting replay with SAME signature MUST fail
    with pytest.raises(HTTPException) as exc_info:
        await auth_service.authenticate_wallet(
            session=session,
            wallet_address=wallet_address,
            message=msg,
            signature=signature
        )
    assert exc_info.value.status_code == 401
    assert "replay attack detected" in str(exc_info.value.detail).lower()

@pytest.mark.asyncio
async def test_siwe_unsupported_chain_id(session: AsyncSession, eth_wallet):
    nonce = await auth_service.generate_siwe_nonce()
    msg = (
        f"agentchain.ai wants you to sign in with your Ethereum account:\n"
        f"{eth_wallet.address}\n\n"
        f"Chain ID: 99999\n" # Unsupported chain
        f"Nonce: {nonce}\n"
    )
    signable = encode_defunct(text=msg)
    signed = Account.sign_message(signable, private_key=eth_wallet.key)

    with pytest.raises(HTTPException) as exc_info:
        await auth_service.authenticate_wallet(
            session=session,
            wallet_address=eth_wallet.address,
            message=msg,
            signature=signed.signature.hex()
        )
    assert exc_info.value.status_code == 400
    assert "unsupported chain id" in str(exc_info.value.detail).lower()

@pytest.mark.asyncio
async def test_siwe_wrong_domain_rejection(session: AsyncSession, eth_wallet):
    nonce = await auth_service.generate_siwe_nonce()
    msg = (
        f"phishing-domain.com wants you to sign in with your Ethereum account:\n"
        f"{eth_wallet.address}\n\n"
        f"Nonce: {nonce}\n"
    )
    signable = encode_defunct(text=msg)
    signed = Account.sign_message(signable, private_key=eth_wallet.key)

    with pytest.raises(HTTPException) as exc_info:
        await auth_service.authenticate_wallet(
            session=session,
            wallet_address=eth_wallet.address,
            message=msg,
            signature=signed.signature.hex()
        )
    assert exc_info.value.status_code == 400
    assert "domain" in str(exc_info.value.detail).lower()

@pytest.mark.asyncio
async def test_siwe_address_mismatch_rejection(session: AsyncSession, eth_wallet):
    other_acct = Account.create()
    nonce = await auth_service.generate_siwe_nonce()
    msg = (
        f"agentchain.ai wants you to sign in with your Ethereum account:\n"
        f"{other_acct.address}\n\n" # Mismatched inside message body
        f"Nonce: {nonce}\n"
    )
    signable = encode_defunct(text=msg)
    signed = Account.sign_message(signable, private_key=eth_wallet.key)

    with pytest.raises(HTTPException) as exc_info:
        await auth_service.authenticate_wallet(
            session=session,
            wallet_address=eth_wallet.address, # Claims eth_wallet
            message=msg,
            signature=signed.signature.hex()
        )
    assert exc_info.value.status_code == 400
    assert "address" in str(exc_info.value.detail).lower()

@pytest.mark.asyncio
async def test_siwe_expired_message_rejection(session: AsyncSession, eth_wallet):
    nonce = await auth_service.generate_siwe_nonce()
    msg = (
        f"agentchain.ai wants you to sign in with your Ethereum account:\n"
        f"{eth_wallet.address}\n\n"
        f"Nonce: {nonce}\n"
        f"Expiration Time: 2020-01-01T00:00:00Z\n" # Expired!
    )
    signable = encode_defunct(text=msg)
    signed = Account.sign_message(signable, private_key=eth_wallet.key)

    with pytest.raises(HTTPException) as exc_info:
        await auth_service.authenticate_wallet(
            session=session,
            wallet_address=eth_wallet.address,
            message=msg,
            signature=signed.signature.hex()
        )
    assert exc_info.value.status_code == 400
    assert "expired" in str(exc_info.value.detail).lower()

# ---------------------------------------------------------------------------
# 2. SESSION REVOCATION & TOKEN BLACKLISTING
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_session_revocation_and_token_blacklist(session: AsyncSession, eth_wallet):
    token = auth_service.create_access_token("user-123", "test@agentchain.ai")
    payload = await auth_service.verify_jwt_token(token)
    assert payload is not None
    jti = payload["jti"]

    # Active token verifies
    payload_check = await auth_service.verify_jwt_token(token)
    assert payload_check is not None

    # Blacklist token
    await redis_service.blacklist_token(jti)

    # Verification now fails
    payload_after = await auth_service.verify_jwt_token(token)
    assert payload_after is None

# ---------------------------------------------------------------------------
# 3. WALLET COLLISION & SAFETY CHECKS
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_wallet_link_collision_prevention(session: AsyncSession, eth_wallet, eth_wallet_2):
    user_a = User(full_name="User A", email="usera@agentchain.ai")
    user_b = User(full_name="User B", email="userb@agentchain.ai")
    session.add_all([user_a, user_b])
    await session.flush()

    # User A links eth_wallet
    wallet_a = Wallet(user_id=user_a.id, address=eth_wallet.address.lower(), is_primary=True)
    session.add(wallet_a)
    await session.commit()

    # User B attempts to link User A's wallet
    msg = f"Link wallet to account {user_b.id}"
    signed = Account.sign_message(encode_defunct(text=msg), private_key=eth_wallet.key)

    with pytest.raises(HTTPException) as exc_info:
        await wallet_service.link_wallet(
            session=session,
            user=user_b,
            wallet_address=eth_wallet.address,
            message=msg,
            signature=signed.signature.hex()
        )
    assert exc_info.value.status_code == 400
    assert "associated with another user account" in str(exc_info.value.detail).lower()

@pytest.mark.asyncio
async def test_wallet_unlinking_safety_checks(session: AsyncSession, eth_wallet):
    user = User(full_name="Single Wallet User") # No password set!
    session.add(user)
    await session.flush()

    wallet = Wallet(user_id=user.id, address=eth_wallet.address.lower(), is_primary=True)
    session.add(wallet)
    await session.commit()

    # Unlinking single authentication wallet MUST fail
    with pytest.raises(HTTPException) as exc_info:
        await wallet_service.unlink_wallet(session=session, user=user, wallet_id=wallet.id)
    assert exc_info.value.status_code == 400
    assert "only authentication wallet" in str(exc_info.value.detail).lower()

# ---------------------------------------------------------------------------
# 4. IDOR DEFENSES
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_idor_resource_ownership_protection(session: AsyncSession):
    user_a = User(full_name="User A")
    user_b = User(full_name="User B")
    session.add_all([user_a, user_b])
    await session.flush()

    task_b = Task(created_by=user_b.id, title="User B Secret Task", user_prompt="Prompt")
    agent_b = Agent(owner_id=user_b.id, name="User B Agent", slug="ub-agent", description="Desc", category="coding")
    session.add_all([task_b, agent_b])
    await session.commit()

    # User A accessing User B task MUST raise 403 Forbidden
    with pytest.raises(HTTPException) as exc_info:
        assert_task_ownership(task_b, user_a, ["USER"])
    assert exc_info.value.status_code == 403

    # User A accessing User B agent MUST raise 403 Forbidden
    with pytest.raises(HTTPException) as exc_info:
        assert_agent_ownership(agent_b, user_a, ["USER"])
    assert exc_info.value.status_code == 403

# ---------------------------------------------------------------------------
# 5. ADMIN ONE-TIME BOOTSTRAP CLI
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_admin_one_time_bootstrap(session: AsyncSession):
    # Run first bootstrap with fixture session
    await run_bootstrap("admin@agentchain.ai", "SuperAdminPassword2026!", "Admin User", session=session)

    # Verify SUPER_ADMIN in DB
    stmt = select(User).where(User.email == "admin@agentchain.ai")
    res = await session.execute(stmt)
    admin_user = res.scalar_one()
    assert admin_user is not None
    assert admin_user.user_roles[0].role.name == "SUPER_ADMIN"
