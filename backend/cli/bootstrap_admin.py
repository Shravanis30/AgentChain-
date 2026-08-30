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

async def _bootstrap_in_session(session: AsyncSession, email: str, password: str, full_name: str) -> None:
    stmt = select(Role).where(Role.name == "SUPER_ADMIN")
    res = await session.execute(stmt)
    super_admin_role = res.scalar_one_or_none()

    if not super_admin_role:
        logger.error("SUPER_ADMIN role not found in database. Run database bootstrap first.")
        sys.exit(1)

    stmt_check = select(UserRole).where(UserRole.role_id == super_admin_role.id)
    res_check = await session.execute(stmt_check)
    existing_admin = res_check.scalar_one_or_none()

    if existing_admin:
        logger.error("SECURITY DISALLOWED: A SUPER_ADMIN user already exists in the system. One-time bootstrap disabled.")
        sys.exit(1)

    # Create new Super Admin User
    user = User(
        email=email.strip().lower(),
        password_hash=auth_service.hash_password(password),
        full_name=full_name,
        is_active=True,
        is_verified=True
    )
    session.add(user)
    await session.flush()

    ur = UserRole(user_id=user.id, role_id=super_admin_role.id)
    session.add(ur)

    audit = AuditLog(
        actor_id=user.id,
        action="ONE_TIME_ADMIN_BOOTSTRAP",
        resource_type="user",
        resource_id=user.id,
        details={"email": email, "role": "SUPER_ADMIN"}
    )
    session.add(audit)
    await session.commit()

    logger.info(f"SUCCESS: Created initial SUPER_ADMIN user ({email}) with ID {user.id}.")

async def run_bootstrap(email: str, password: str, full_name: str, session: Optional[AsyncSession] = None) -> None:
    if session:
        await _bootstrap_in_session(session, email, password, full_name)
    else:
        async with async_session_factory() as s:
            await _bootstrap_in_session(s, email, password, full_name)

def main():
    parser = argparse.ArgumentParser(description="AgentChain Secure One-Time Administrative Bootstrap CLI")
    parser.add_argument("--email", required=True, help="Administrator email address")
    parser.add_argument("--password", required=True, help="Administrator password (min 8 chars)")
    parser.add_argument("--name", default="System Administrator", help="Administrator full name")

    args = parser.parse_args()

    if len(args.password) < 8:
        logger.error("Password must be at least 8 characters long.")
        sys.exit(1)

    asyncio.run(run_bootstrap(args.email, args.password, args.name))

if __name__ == "__main__":
    main()
