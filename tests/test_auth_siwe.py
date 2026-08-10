import pytest
import pytest_asyncio
from eth_account import Account
from eth_account.messages import encode_defunct
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import select
from fastapi import HTTPException

from backend.db.models import Base, User, Wallet, Role, Permission
from backend.db.bootstrap import bootstrap_roles_and_permissions
from backend.auth_service.auth import auth_service
from backend.auth_service.wallet import wallet_service

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
    """Generates an ephemeral real Ethereum keypair for tests."""
    acct = Account.create()
    return acct

@pytest.mark.asyncio
async def test_siwe_nonce_lifecycle():
    nonce = await auth_service.generate_siwe_nonce()
    assert len(nonce) == 32

    # Consuming the first time succeeds
    consumed = await auth_service.consume_siwe_nonce(nonce)
    assert consumed is not None

    # Consuming the second time fails (prevents replay attacks)
    consumed_again = await auth_service.consume_siwe_nonce(nonce)
    assert consumed_again is None

@pytest.mark.asyncio
async def test_cryptographic_siwe_login_flow(session: AsyncSession, eth_wallet):
    nonce = await auth_service.generate_siwe_nonce()
    wallet_address = eth_wallet.address

    siwe_message = (
        f"agentchain.ai wants you to sign in with your Ethereum account:\n"
        f"{wallet_address}\n\n"
        f"Sign in with Ethereum to AgentChain Enterprise Platform.\n\n"
        f"URI: https://agentchain.ai\n"
        f"Version: 1\n"
        f"Chain ID: 137\n"
        f"Nonce: {nonce}\n"
        f"Issued At: 2026-08-16T12:00:00Z"
    )

    # Sign the message with private key
    signable = encode_defunct(text=siwe_message)
    signed = Account.sign_message(signable, private_key=eth_wallet.key)
    signature = signed.signature.hex()

    # Authenticate
    auth_result = await auth_service.authenticate_wallet(
        session=session,
        wallet_address=wallet_address,
        message=siwe_message,
        signature=signature
    )

    assert auth_result["access_token"] is not None
    assert auth_result["wallet_address"] == wallet_address.lower()
    assert "USER" in auth_result["roles"]

    # Verify user was saved in DB
    user_id = auth_result["user_id"]
    user_in_db = (await session.execute(select(User).where(User.id == user_id))).scalar_one()
    assert len(user_in_db.wallets) == 1
    assert user_in_db.wallets[0].address == wallet_address.lower()

    # Repeat login with same wallet resolves the same user
    new_nonce = await auth_service.generate_siwe_nonce()
    siwe_message_2 = (
        f"agentchain.ai wants you to sign in with your Ethereum account:\n"
        f"{wallet_address}\n\n"
        f"Sign in with Ethereum to AgentChain Enterprise Platform.\n\n"
        f"URI: https://agentchain.ai\n"
        f"Version: 1\n"
        f"Chain ID: 137\n"
        f"Nonce: {new_nonce}\n"
        f"Issued At: 2026-08-16T12:05:00Z"
    )
    signed_2 = Account.sign_message(encode_defunct(text=siwe_message_2), private_key=eth_wallet.key)
    auth_result_2 = await auth_service.authenticate_wallet(
        session=session,
        wallet_address=wallet_address,
        message=siwe_message_2,
        signature=signed_2.signature.hex()
    )

    assert auth_result_2["user_id"] == user_id  # Same user resolved!

@pytest.mark.asyncio
async def test_siwe_rejects_tampered_signature(session: AsyncSession, eth_wallet):
    nonce = await auth_service.generate_siwe_nonce()
    wallet_address = eth_wallet.address

    siwe_message = (
        f"agentchain.ai wants you to sign in with your Ethereum account:\n"
        f"{wallet_address}\n\n"
        f"Nonce: {nonce}\n"
    )

    # Sign with a different wallet
    other_acct = Account.create()
    signed = Account.sign_message(encode_defunct(text=siwe_message), private_key=other_acct.key)

    with pytest.raises(HTTPException) as exc_info:
        await auth_service.authenticate_wallet(
            session=session,
            wallet_address=wallet_address, # claim to be eth_wallet
            message=siwe_message,
            signature=signed.signature.hex() # but signed by other_acct
        )
    assert exc_info.value.status_code == 401
    assert "signature verification failed" in str(exc_info.value.detail).lower()

@pytest.mark.asyncio
async def test_link_secondary_wallet(session: AsyncSession, eth_wallet):
    # Setup primary user
    user = User(full_name="Multi Wallet User")
    session.add(user)
    await session.flush()

    primary_wallet = Wallet(user_id=user.id, address=eth_wallet.address.lower(), is_primary=True)
    session.add(primary_wallet)
    await session.commit()

    # Link second wallet
    second_acct = Account.create()
    msg = f"Link secondary wallet to AgentChain account: {user.id}"
    signed = Account.sign_message(encode_defunct(text=msg), private_key=second_acct.key)

    res = await wallet_service.link_wallet(
        session=session,
        user=user,
        wallet_address=second_acct.address,
        message=msg,
        signature=signed.signature.hex()
    )
    assert res["status"] == "success"

    wallets = await wallet_service.list_wallets(session, user.id)
    assert len(wallets) == 2
    addresses = [w["address"] for w in wallets]
    assert eth_wallet.address.lower() in addresses
    assert second_acct.address.lower() in addresses
