from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.db.session import get_db
from backend.db.models import User, Wallet, Session as UserSession, Role, UserRole
from backend.auth_service.auth import auth_service
from backend.auth_service.rbac import get_current_user
from backend.auth_service.wallet import wallet_service
from backend.auth_service.rate_limiter import rate_limit

router = APIRouter(prefix="/api/v1/auth", tags=["Authentication & Wallets"])

# Request / Response Schemas
class SIWEVerifyRequest(BaseModel):
    wallet_address: str
    message: str
    signature: str

class PasswordRegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8)
    full_name: str
    role: Optional[str] = "AGENT_OWNER"

class PasswordLoginRequest(BaseModel):
    email: EmailStr
    password: str

class PasswordChangeRequest(BaseModel):
    old_password: str
    new_password: str = Field(..., min_length=8)

class LinkWalletRequest(BaseModel):
    wallet_address: str
    message: str
    signature: str
    chain_id: int = 137

class PrimaryWalletRequest(BaseModel):
    wallet_address: str

class SessionRevokeRequest(BaseModel):
    session_id: Optional[str] = None
    revoke_all: bool = False


@router.get("/nonce", dependencies=[Depends(rate_limit(max_requests=20, window_seconds=60))])
async def get_nonce(wallet_address: Optional[str] = Query(None)):
    """Generates an EIP-4361 single-use random SIWE nonce challenge stored in Redis."""
    nonce = await auth_service.generate_siwe_nonce(wallet_address)
    return {"nonce": nonce, "expires_in_seconds": 300}


@router.post("/siwe", dependencies=[Depends(rate_limit(max_requests=10, window_seconds=60))])
async def verify_siwe(
    req: SIWEVerifyRequest,
    request: Request,
    session: AsyncSession = Depends(get_db)
):
    """Cryptographically verifies EIP-4361 SIWE signature, resolves user, and issues JWT + Session."""
    ip = request.client.host if request.client else None
    ua = request.headers.get("user-agent")
    res = await auth_service.authenticate_wallet(
        session=session,
        wallet_address=req.wallet_address,
        message=req.message,
        signature=req.signature,
        ip_address=ip,
        user_agent=ua
    )
    return res


@router.post("/register", dependencies=[Depends(rate_limit(max_requests=5, window_seconds=60))])
async def register_password_user(
    req: PasswordRegisterRequest,
    session: AsyncSession = Depends(get_db)
):
    """Registers a new user account with Argon2id password hashing."""
    clean_email = req.email.strip().lower()

    # Prevent enumeration by checking existing email
    stmt = select(User).where(User.email == clean_email)
    res = await session.execute(stmt)
    if res.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email address already exists."
        )

    user = User(
        email=clean_email,
        password_hash=auth_service.hash_password(req.password),
        full_name=req.full_name,
        is_active=True
    )
    session.add(user)
    await session.flush()

    assigned_role_name = req.role if req.role in ["AGENT_OWNER", "USER"] else "AGENT_OWNER"
    stmt_role = select(Role).where(Role.name == assigned_role_name)
    res_role = await session.execute(stmt_role)
    role_obj = res_role.scalar_one_or_none()
    if role_obj:
        ur = UserRole(user_id=user.id, role_id=role_obj.id)
        session.add(ur)

    await session.commit()

    roles, permissions = await auth_service.get_user_roles_and_permissions(session, user.id)
    token = auth_service.create_access_token(user_id=user.id, email=clean_email, roles=roles, permissions=permissions)

    return {
        "access_token": token,
        "token_type": "bearer",
        "user_id": user.id,
        "email": user.email,
        "roles": roles,
        "permissions": permissions
    }


@router.post("/login", dependencies=[Depends(rate_limit(max_requests=5, window_seconds=60))])
async def login_password_user(
    req: PasswordLoginRequest,
    request: Request,
    session: AsyncSession = Depends(get_db)
):
    """Authenticates user via email and password using Argon2id verification."""
    clean_email = req.email.strip().lower()
    stmt = select(User).where(User.email == clean_email, User.is_active == True)
    res = await session.execute(stmt)
    user = res.scalar_one_or_none()

    if not user or not user.password_hash or not auth_service.verify_password(req.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password."
        )

    roles, permissions = await auth_service.get_user_roles_and_permissions(session, user.id)
    token = auth_service.create_access_token(user_id=user.id, email=clean_email, roles=roles, permissions=permissions)

    ip = request.client.host if request.client else None
    ua = request.headers.get("user-agent")

    user_session = UserSession(
        user_id=user.id,
        token_hash=jti,
        ip_address=ip,
        user_agent=ua,
        auth_method="password",
        expires_at=auth_service.utc_now()
    )
    session.add(user_session)
    await session.commit()

    return {
        "access_token": token,
        "token_type": "bearer",
        "user_id": user.id,
        "email": user.email,
        "roles": roles,
        "permissions": permissions
    }


@router.post("/logout")
async def logout_user(
    request: Request,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db)
):
    """Logs out user, revoking the current session and blacklisting its JWT JTI token."""
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        payload = await auth_service.verify_jwt_token(token)
        if payload and payload.get("jti"):
            await auth_service.revoke_user_session(session, user.id, session_id="", jti=payload["jti"])

    return {"status": "success", "message": "Successfully logged out."}


@router.post("/sessions/revoke")
async def revoke_sessions(
    req: SessionRevokeRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db)
):
    """Revokes specific user session or all active user sessions."""
    if req.revoke_all:
        await auth_service.revoke_all_user_sessions(session, user.id)
        return {"status": "success", "message": "All active sessions revoked."}
    elif req.session_id:
        await auth_service.revoke_user_session(session, user.id, req.session_id, jti="")
        return {"status": "success", "message": f"Session {req.session_id} revoked."}
    else:
        raise HTTPException(status_code=400, detail="Must specify session_id or set revoke_all=True.")


@router.post("/password/change")
async def change_password(
    req: PasswordChangeRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db)
):
    """Changes user password and invalidates all existing active sessions."""
    if not user.password_hash or not auth_service.verify_password(req.old_password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Current password verification failed."
        )

    user.password_hash = auth_service.hash_password(req.new_password)
    await auth_service.revoke_all_user_sessions(session, user.id)
    await session.commit()

    return {"status": "success", "message": "Password changed successfully. All active sessions invalidated."}


@router.get("/me")
async def get_current_user_profile(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db)
):
    """Returns authenticated user profile, roles, permissions, and linked wallets."""
    roles, permissions = await auth_service.get_user_roles_and_permissions(session, user.id)
    wallets = await wallet_service.list_wallets(session, user.id)

    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "avatar_url": user.avatar_url,
        "roles": roles,
        "permissions": permissions,
        "wallets": wallets,
        "created_at": user.created_at.isoformat()
    }


@router.get("/wallets")
async def list_wallets(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db)
):
    return await wallet_service.list_wallets(session, user.id)


@router.post("/wallets/link", dependencies=[Depends(rate_limit(max_requests=10, window_seconds=60))])
async def link_wallet(
    req: LinkWalletRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db)
):
    return await wallet_service.link_wallet(
        session=session,
        user=user,
        wallet_address=req.wallet_address,
        message=req.message,
        signature=req.signature,
        chain_id=req.chain_id
    )


@router.post("/wallets/primary")
async def set_primary_wallet(
    req: PrimaryWalletRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db)
):
    return await wallet_service.set_primary_wallet(
        session=session,
        user=user,
        wallet_address=req.wallet_address
    )


@router.delete("/wallets/{wallet_id}")
async def unlink_wallet(
    wallet_id: str,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db)
):
    return await wallet_service.unlink_wallet(
        session=session,
        user=user,
        wallet_id=wallet_id
    )
