import argparse
import asyncio
import sys
import logging
from sqlalchemy import select

from backend.db.session import async_session_factory
from backend.db.models import User, Role, UserRole, AuditLog
from backend.auth_service.auth import auth_service

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("agentchain.cli")

from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession

async def _bootstrap_in_session(
    session: AsyncSession,
    email: str,
    password: str,
    full_name: str,
    reset: bool = False
) -> None:
    stmt = select(Role).where(Role.name == "SUPER_ADMIN")
    res = await session.execute(stmt)
    super_admin_role = res.scalar_one_or_none()

    if not super_admin_role:
        logger.error("SUPER_ADMIN role not found in database. Run database bootstrap first.")
        sys.exit(1)

    stmt_check = select(UserRole).where(UserRole.role_id == super_admin_role.id)
    res_check = await session.execute(stmt_check)
    existing_admin = res_check.scalar_one_or_none()

    if existing_admin and not reset:
        logger.error("SECURITY DISALLOWED: A SUPER_ADMIN user already exists in the system. One-time bootstrap disabled. Pass --reset to update credentials.")
        sys.exit(1)

    clean_email = email.strip().lower()
    stmt_user = select(User).where(User.email == clean_email)
    res_user = await session.execute(stmt_user)
    user = res_user.scalar_one_or_none()

    if user:
        user.password_hash = auth_service.hash_password(password)
        user.is_active = True
        user.is_verified = True
        logger.info(f"Updated password hash for existing user ({clean_email}).")
    else:
        user = User(
            email=clean_email,
            password_hash=auth_service.hash_password(password),
            full_name=full_name,
            is_active=True,
            is_verified=True
        )
        session.add(user)
        await session.flush()

    # Assign SUPER_ADMIN role
    stmt_ur = select(UserRole).where(UserRole.user_id == user.id, UserRole.role_id == super_admin_role.id)
    res_ur = await session.execute(stmt_ur)
    if not res_ur.scalar_one_or_none():
        session.add(UserRole(user_id=user.id, role_id=super_admin_role.id))

    audit = AuditLog(
        actor_id=user.id,
        action="ADMIN_PASSWORD_RESET" if existing_admin else "ONE_TIME_ADMIN_BOOTSTRAP",
        resource_type="user",
        resource_id=user.id,
        details={"email": clean_email, "role": "SUPER_ADMIN"}
    )
    session.add(audit)
    await session.commit()

    logger.info(f"SUCCESS: Configured SUPER_ADMIN user ({clean_email}) with ID {user.id}.")

async def run_bootstrap(
    email: str,
    password: str,
    full_name: str,
    session: Optional[AsyncSession] = None,
    reset: bool = False
) -> None:
    if session:
        await _bootstrap_in_session(session, email, password, full_name, reset=reset)
    else:
        async with async_session_factory() as s:
            await _bootstrap_in_session(s, email, password, full_name, reset=reset)

def main():
    parser = argparse.ArgumentParser(description="AgentChain Secure One-Time Administrative Bootstrap CLI")
    parser.add_argument("--email", required=True, help="Administrator email address")
    parser.add_argument("--password", required=True, help="Administrator password (min 8 chars)")
    parser.add_argument("--name", default="System Administrator", help="Administrator full name")
    parser.add_argument("--reset", action="store_true", help="Allow updating credentials for existing admin")

    args = parser.parse_args()

    if len(args.password) < 8:
        logger.error("Password must be at least 8 characters long.")
        sys.exit(1)

    asyncio.run(run_bootstrap(args.email, args.password, args.name, reset=args.reset))

if __name__ == "__main__":
    main()
