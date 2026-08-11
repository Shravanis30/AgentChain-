from typing import List, Optional, Callable
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.db.session import get_db
from backend.db.models import User, UserRole, Agent, Task, Project, Wallet
from backend.auth_service.auth import auth_service

security_bearer = HTTPBearer(auto_error=False)

async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_bearer),
    session: AsyncSession = Depends(get_db)
) -> User:
    """Dependency that authenticates Bearer JWT, checking signature and Redis revocation."""
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please provide a valid Bearer access token.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    payload = await auth_service.verify_jwt_token(credentials.credentials)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid, expired, or revoked access token.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Malformed token payload."
        )

    stmt = select(User).where(User.id == user_id, User.is_active == True)
    res = await session.execute(stmt)
    user = res.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account not found or deactivated."
        )

    return user


def require_permission(required_perm: str) -> Callable:
    """Factory dependency enforcing a granular permission on a protected endpoint."""
    async def permission_checker(
        user: User = Depends(get_current_user),
        session: AsyncSession = Depends(get_db)
    ) -> User:
        roles, permissions = await auth_service.get_user_roles_and_permissions(session, user.id)

        # SUPER_ADMIN bypasses granular permission checks
        if "SUPER_ADMIN" in roles:
            return user

        if required_perm not in permissions:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Forbidden: Missing required permission '{required_perm}'."
            )
        return user

    return permission_checker


def require_role(required_role: str) -> Callable:
    """Factory dependency enforcing that a user possesses a specific role."""
    async def role_checker(
        user: User = Depends(get_current_user),
        session: AsyncSession = Depends(get_db)
    ) -> User:
        roles, _ = await auth_service.get_user_roles_and_permissions(session, user.id)

        if "SUPER_ADMIN" in roles or required_role in roles:
            return user

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Forbidden: Requires role '{required_role}'."
        )

    return role_checker


# ---------------------------------------------------------------------------
# IDOR & RESOURCE-LEVEL AUTHORIZATION ASSERTIONS
# ---------------------------------------------------------------------------

def assert_agent_ownership(agent: Agent, user: User, user_roles: List[str]) -> None:
    """Ensures caller owns the agent or is platform admin."""
    if "SUPER_ADMIN" in user_roles or "ADMIN" in user_roles:
        return
    if agent.owner_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: You do not have ownership of this agent resource."
        )

def assert_task_ownership(task: Task, user: User, user_roles: List[str]) -> None:
    """Ensures caller created the task or is platform admin/auditor."""
    if "SUPER_ADMIN" in user_roles or "ADMIN" in user_roles or "AUDITOR" in user_roles:
        return
    if task.created_by != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: You do not have permission to access this task resource."
        )

def assert_project_ownership(project: Project, user: User, user_roles: List[str]) -> None:
    """Ensures caller created the project or is platform admin."""
    if "SUPER_ADMIN" in user_roles or "ADMIN" in user_roles:
        return
    if project.created_by != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: You do not have permission to access this project resource."
        )

def assert_wallet_ownership(wallet: Wallet, user: User, user_roles: List[str]) -> None:
    """Ensures caller owns the wallet or is platform admin."""
    if "SUPER_ADMIN" in user_roles or "ADMIN" in user_roles:
        return
    if wallet.user_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: You do not have permission to manage this wallet resource."
        )
