from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.db.session import get_db
from backend.db.models import User, Agent, AuditLog, SecurityEvent, utc_now
from backend.auth_service.rbac import get_current_user, require_permission

router = APIRouter(prefix="/api/v1/admin", tags=["Admin & Platform Governance"])

class AdminRejectSchema(BaseModel):
    reason: str

@router.get("/users", dependencies=[Depends(require_permission("admin:users"))])
async def list_all_users(session: AsyncSession = Depends(get_db)):
    stmt = select(User).order_by(User.created_at.desc()).limit(100)
    res = await session.execute(stmt)
    users = res.scalars().all()
    return [
        {
            "id": u.id,
            "email": u.email,
            "full_name": u.full_name,
            "is_active": u.is_active,
            "wallets_count": len(u.wallets),
            "created_at": u.created_at.isoformat()
        }
        for u in users
    ]

@router.get("/agents/pending", dependencies=[Depends(require_permission("admin:agents"))])
async def list_pending_agents(session: AsyncSession = Depends(get_db)):
    """Lists agents waiting for administrative review."""
    stmt = select(Agent).where(Agent.status == "PENDING_REVIEW").order_by(Agent.updated_at.asc())
    res = await session.execute(stmt)
    agents = res.scalars().all()
    return [
        {
            "id": a.id,
            "name": a.name,
            "slug": a.slug,
            "category": a.category,
            "status": a.status,
            "owner_id": a.owner_id,
            "created_at": a.created_at.isoformat(),
            "latest_version": a.versions[-1].version if a.versions else "v1.0.0",
            "last_validation": a.validations[-1].passed if a.validations else False
        }
        for a in agents
    ]

@router.post("/agents/{agent_id}/approve", dependencies=[Depends(require_permission("admin:agents"))])
async def approve_agent(
    agent_id: str,
    admin_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db)
):
    """Approves an agent submission (enforces that owner cannot self-approve)."""
    stmt = select(Agent).where(Agent.id == agent_id)
    res = await session.execute(stmt)
    agent = res.scalar_one_or_none()

    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found.")

    if agent.owner_id == admin_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Conflict of interest: Agent owners cannot approve their own agents."
        )

    if agent.status != "PENDING_REVIEW":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Agent is not in PENDING_REVIEW state (current: '{agent.status}')."
        )

    agent.status = "APPROVED"
    audit = AuditLog(
        actor_id=admin_user.id,
        action="AGENT_APPROVED_BY_ADMIN",
        resource_type="agent",
        resource_id=agent.id,
        details={"owner_id": agent.owner_id}
    )
    session.add(audit)
    await session.commit()

    return {"status": "success", "agent_id": agent.id, "new_status": agent.status}

@router.post("/agents/{agent_id}/reject", dependencies=[Depends(require_permission("admin:agents"))])
async def reject_agent(
    agent_id: str,
    req: AdminRejectSchema,
    admin_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db)
):
    """Rejects an agent submission with feedback reason."""
    stmt = select(Agent).where(Agent.id == agent_id)
    res = await session.execute(stmt)
    agent = res.scalar_one_or_none()

    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found.")

    agent.status = "REJECTED"
    audit = AuditLog(
        actor_id=admin_user.id,
        action="AGENT_REJECTED_BY_ADMIN",
        resource_type="agent",
        resource_id=agent.id,
        details={"reason": req.reason}
    )
    session.add(audit)
    await session.commit()

    return {"status": "success", "agent_id": agent.id, "new_status": agent.status, "reason": req.reason}

@router.post("/agents/{agent_id}/suspend", dependencies=[Depends(require_permission("admin:agents"))])
async def suspend_agent(
    agent_id: str,
    admin_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db)
):
    """Immediately suspends an agent, removing it from the public marketplace."""
    stmt = select(Agent).where(Agent.id == agent_id)
    res = await session.execute(stmt)
    agent = res.scalar_one_or_none()

    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found.")

    agent.status = "SUSPENDED"
    agent.suspended_at = utc_now()

    audit = AuditLog(
        actor_id=admin_user.id,
        action="AGENT_SUSPENDED_BY_ADMIN",
        resource_type="agent",
        resource_id=agent.id
    )
    session.add(audit)
    await session.commit()

    return {"status": "success", "agent_id": agent.id, "new_status": agent.status}

@router.get("/audit-logs", dependencies=[Depends(require_permission("admin:audit"))])
async def list_audit_logs(session: AsyncSession = Depends(get_db)):
    stmt = select(AuditLog).order_by(AuditLog.timestamp.desc()).limit(100)
    res = await session.execute(stmt)
    logs = res.scalars().all()
    return [
        {
            "id": l.id,
            "actor_id": l.actor_id,
            "action": l.action,
            "resource_type": l.resource_type,
            "resource_id": l.resource_id,
            "details": l.details,
            "timestamp": l.timestamp.isoformat()
        }
        for l in logs
    ]

@router.get("/security-events", dependencies=[Depends(require_permission("admin:security"))])
async def list_security_events(session: AsyncSession = Depends(get_db)):
    stmt = select(SecurityEvent).order_by(SecurityEvent.timestamp.desc()).limit(100)
    res = await session.execute(stmt)
    events = res.scalars().all()
    return [
        {
            "id": e.id,
            "event_type": e.event_type,
            "severity": e.severity,
            "actor_id": e.actor_id,
            "payload": e.raw_payload,
            "mitigated": e.mitigated,
            "timestamp": e.timestamp.isoformat()
        }
        for e in events
    ]
