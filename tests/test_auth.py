import pytest
from eth_account import Account
from eth_account.messages import encode_defunct
from backend.auth_service.auth import auth_service

@pytest.mark.asyncio
async def test_jwt_token_generation_and_verification():
    user_id = "usr-test-12345"
    email = "developer@agentchain.ai"
    wallet = "0x71C7656EC7ab88b098defB751B7401B5f6d8976F".lower()
    roles = ["AGENT_OWNER"]
    perms = ["agent:create", "task:create"]

    token = auth_service.create_access_token(
        user_id=user_id,
        email=email,
        wallet_address=wallet,
        roles=roles,
        permissions=perms
    )

    assert token is not None
    payload = await auth_service.verify_jwt_token(token)
    assert payload is not None
    assert payload["sub"] == user_id
    assert payload["email"] == email
    assert payload["wallet_address"] == wallet
    assert "AGENT_OWNER" in payload["roles"]
    assert "agent:create" in payload["permissions"]

def test_argon2_password_hashing():
    password = "MySecurePassword2026!"
    hashed = auth_service.hash_password(password)
    assert hashed != password
    assert auth_service.verify_password(password, hashed) is True
    assert auth_service.verify_password("WrongPassword", hashed) is False

def test_real_cryptographic_siwe_verification():
    acct = Account.create()
    msg = "Sign in to AgentChain Enterprise Platform: Nonce 9876543210"
    signed = Account.sign_message(encode_defunct(text=msg), private_key=acct.key)

    # Valid signature check returns True
    assert auth_service.verify_siwe_signature(acct.address, msg, signed.signature.hex()) is True

    # Tampered message returns False
    assert auth_service.verify_siwe_signature(acct.address, "Tampered Message", signed.signature.hex()) is False
