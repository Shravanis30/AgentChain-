import logging
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from backend.db.models import Role, Permission, RolePermission, User, UserRole
from backend.config import settings

logger = logging.getLogger("agentchain.bootstrap")

SYSTEM_PERMISSIONS = [
    # Agents
    {"name": "agent:create", "description": "Create a new AI agent", "category": "agent"},
    {"name": "agent:read", "description": "View agent details and versions", "category": "agent"},
    {"name": "agent:update", "description": "Update agent configuration", "category": "agent"},
    {"name": "agent:publish", "description": "Submit and publish agent to marketplace", "category": "agent"},
    {"name": "agent:suspend", "description": "Suspend or unpublish an agent", "category": "agent"},
    {"name": "agent:delete", "description": "Archive or delete an agent", "category": "agent"},

    # Tasks & Swarms
    {"name": "task:create", "description": "Launch new multi-agent swarm task", "category": "task"},
    {"name": "task:read", "description": "View task execution traces and results", "category": "task"},
    {"name": "task:cancel", "description": "Cancel a running task", "category": "task"},

    # Wallets & Blockchain
    {"name": "wallet:read", "description": "View connected wallet accounts", "category": "wallet"},
    {"name": "wallet:link", "description": "Link or unlink secondary wallets", "category": "wallet"},
    {"name": "transaction:read", "description": "View blockchain transaction history", "category": "financial"},
    {"name": "withdrawal:create", "description": "Request developer earnings withdrawal", "category": "financial"},
    {"name": "withdrawal:read", "description": "View withdrawal requests", "category": "financial"},

    # Administration & Auditing
    {"name": "admin:users", "description": "Manage platform user accounts", "category": "admin"},
    {"name": "admin:agents", "description": "Review, approve, and suspend marketplace agents", "category": "admin"},
    {"name": "admin:transactions", "description": "Inspect escrows and settlements", "category": "admin"},
    {"name": "admin:security", "description": "View security events and manage policies", "category": "admin"},
    {"name": "admin:audit", "description": "Inspect immutable platform audit logs", "category": "admin"},
    {"name": "admin:disputes", "description": "Arbitrate escrow disputes", "category": "admin"},
]

ROLE_PERMISSIONS_MAP = {
    "SUPER_ADMIN": [p["name"] for p in SYSTEM_PERMISSIONS],
    "ADMIN": [
        "agent:create", "agent:read", "agent:update", "agent:publish", "agent:suspend", "agent:delete",
        "task:create", "task:read", "task:cancel",
        "wallet:read", "wallet:link", "transaction:read", "withdrawal:create", "withdrawal:read",
        "admin:users", "admin:agents", "admin:transactions", "admin:security", "admin:audit", "admin:disputes"
    ],
    "MODERATOR": [
        "agent:read", "agent:publish", "agent:suspend",
        "task:read", "admin:agents", "admin:disputes"
    ],
    "AGENT_OWNER": [
        "agent:create", "agent:read", "agent:update", "agent:publish",
        "task:create", "task:read",
        "wallet:read", "wallet:link", "transaction:read", "withdrawal:create", "withdrawal:read"
    ],
    "USER": [
        "agent:read",
        "task:create", "task:read", "task:cancel",
        "wallet:read", "wallet:link", "transaction:read"
    ],
    "AUDITOR": [
        "admin:audit", "admin:security", "transaction:read", "agent:read", "task:read"
    ],
    "SUPPORT": [
        "agent:read", "task:read", "admin:users", "admin:disputes"
    ],
}

async def bootstrap_roles_and_permissions(session: AsyncSession) -> None:
    """Idempotently seeds required RBAC roles and permissions without demo data."""
    # 1. Seed Permissions
    permission_objs = {}
    for p_data in SYSTEM_PERMISSIONS:
        stmt = select(Permission).where(Permission.name == p_data["name"])
        res = await session.execute(stmt)
        perm = res.scalar_one_or_none()
        if not perm:
            perm = Permission(
                name=p_data["name"],
                description=p_data["description"],
                category=p_data["category"]
            )
            session.add(perm)
            await session.flush()
        permission_objs[p_data["name"]] = perm

    # 2. Seed Roles and map Permissions
    for role_name, perm_names in ROLE_PERMISSIONS_MAP.items():
        stmt = select(Role).where(Role.name == role_name)
        res = await session.execute(stmt)
        role = res.scalar_one_or_none()
        if not role:
            role = Role(
                name=role_name,
                description=f"System role for {role_name}",
                is_system=True
            )
            session.add(role)
            await session.flush()

        # Check existing role permissions
        stmt_rp = select(RolePermission).where(RolePermission.role_id == role.id)
        res_rp = await session.execute(stmt_rp)
        existing_perm_ids = {rp.permission_id for rp in res_rp.scalars().all()}

        for p_name in perm_names:
            perm_obj = permission_objs.get(p_name)
            if perm_obj and perm_obj.id not in existing_perm_ids:
                rp = RolePermission(role_id=role.id, permission_id=perm_obj.id)
                session.add(rp)

    await session.commit()
    logger.info("RBAC roles and permissions successfully bootstrapped.")
