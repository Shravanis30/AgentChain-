import uuid
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.db.session import get_db
from backend.db.models import WorkspaceContainer, WorkspaceLease, WorkspaceUsageRecord, User, Agent, utc_now
from backend.auth_service.rbac import get_current_user
from backend.services.workspace_service import workspace_service

router = APIRouter(prefix="/api/v1/workspaces", tags=["Virtual Workspaces & Metering"])

# Schemas
class CreateWorkspaceRequest(BaseModel):
    agent_id: str
    resource_tier: str = Field("MEDIUM", description="SMALL, MEDIUM, or LARGE")
    pricing_mode: str = Field("PER_HOUR", description="PER_HOUR, PER_DAY, or CUSTOM_FLAT")
    rate_usdc: float = Field(15.00, ge=0.1)
    flat_duration_days: Optional[int] = None

class WorkspaceResponse(BaseModel):
    id: str
    owner_id: str
    agent_id: str
    resource_tier: str
    pricing_mode: str
    rate_usdc: float
    status: str
    cpu_usage_percent: float
    ram_usage_mb: int
    uptime_seconds: int
    created_at: str

class RentWorkspaceRequest(BaseModel):
    duration_hours: int = Field(24, ge=1)
    tx_hash: Optional[str] = None

class LeaseResponse(BaseModel):
    id: str
    workspace_id: str
    renter_id: str
    duration_hours: int
    gross_amount_usdc: float
    platform_fee_2percent: float
    net_owner_payout: float
    status: str
    created_at: str

# Endpoints
@router.post("", response_model=WorkspaceResponse, status_code=status.HTTP_201_CREATED)
async def create_workspace(
    payload: CreateWorkspaceRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Deploy an agent to a new virtual workspace container."""
    ws_id = str(uuid.uuid4())

    ws_obj = WorkspaceContainer(
        id=ws_id,
        owner_id=current_user.id,
        agent_id=payload.agent_id,
        resource_tier=payload.resource_tier,
        pricing_mode=payload.pricing_mode,
        rate_usdc=payload.rate_usdc,
        flat_duration_days=payload.flat_duration_days,
        status="RUNNING"
    )
    db.add(ws_obj)
    await db.commit()

    # Trigger Docker Container Provisioning
    workspace_service.provision_workspace(
        workspace_id=ws_id,
        owner_id=current_user.id,
        agent_id=payload.agent_id,
        resource_tier=payload.resource_tier,
        pricing_mode=payload.pricing_mode,
        rate_usdc=payload.rate_usdc
    )

    return WorkspaceResponse(
        id=ws_obj.id,
        owner_id=ws_obj.owner_id,
        agent_id=ws_obj.agent_id,
        resource_tier=ws_obj.resource_tier,
        pricing_mode=ws_obj.pricing_mode,
        rate_usdc=float(ws_obj.rate_usdc),
        status=ws_obj.status,
        cpu_usage_percent=float(ws_obj.cpu_usage_percent),
        ram_usage_mb=ws_obj.ram_usage_mb,
        uptime_seconds=ws_obj.uptime_seconds,
        created_at=ws_obj.created_at.isoformat()
    )

@router.get("/me", response_model=List[WorkspaceResponse])
async def get_my_workspaces(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get all deployed workspaces for current logged-in user."""
    stmt = select(WorkspaceContainer).where(WorkspaceContainer.owner_id == current_user.id)
    res = await db.execute(stmt)
    workspaces = res.scalars().all()

    return [
        WorkspaceResponse(
            id=w.id,
            owner_id=w.owner_id,
            agent_id=w.agent_id,
            resource_tier=w.resource_tier,
            pricing_mode=w.pricing_mode,
            rate_usdc=float(w.rate_usdc),
            status=w.status,
            cpu_usage_percent=float(w.cpu_usage_percent),
            ram_usage_mb=w.ram_usage_mb,
            uptime_seconds=w.uptime_seconds,
            created_at=w.created_at.isoformat()
        )
        for w in workspaces
    ]

@router.get("/{workspace_id}", response_model=WorkspaceResponse)
async def get_workspace(
    workspace_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Get workspace details & real-time telemetry."""
    stmt = select(WorkspaceContainer).where(WorkspaceContainer.id == workspace_id)
    res = await db.execute(stmt)
    w = res.scalar_one_or_none()

    if not w:
        raise HTTPException(status_code=404, detail="Workspace container not found.")

    telemetry = workspace_service.get_telemetry(workspace_id)

    return WorkspaceResponse(
        id=w.id,
        owner_id=w.owner_id,
        agent_id=w.agent_id,
        resource_tier=w.resource_tier,
        pricing_mode=w.pricing_mode,
        rate_usdc=float(w.rate_usdc),
        status=w.status,
        cpu_usage_percent=telemetry.get("cpu_usage_percent", float(w.cpu_usage_percent)),
        ram_usage_mb=telemetry.get("ram_usage_mb", w.ram_usage_mb),
        uptime_seconds=telemetry.get("uptime_seconds", w.uptime_seconds),
        created_at=w.created_at.isoformat()
    )

@router.post("/{workspace_id}/rent", response_model=LeaseResponse)
async def rent_workspace(
    workspace_id: str,
    payload: RentWorkspaceRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Initiate a workspace lease rental (triggers 98% owner / 2% treasury fee calculation)."""
    stmt = select(WorkspaceContainer).where(WorkspaceContainer.id == workspace_id)
    res = await db.execute(stmt)
    w = res.scalar_one_or_none()

    if not w:
        raise HTTPException(status_code=404, detail="Workspace container not found.")

    gross = float(w.rate_usdc) * payload.duration_hours
    fee_2pct = round(gross * 0.02, 4)
    net_owner = round(gross - fee_2pct, 4)

    lease = WorkspaceLease(
        id=str(uuid.uuid4()),
        workspace_id=w.id,
        renter_id=current_user.id,
        duration_hours=payload.duration_hours,
        gross_amount_usdc=gross,
        platform_fee_2percent=fee_2pct,
        net_owner_payout=net_owner,
        tx_hash=payload.tx_hash,
        status="ACTIVE"
    )
    db.add(lease)
    await db.commit()

    return LeaseResponse(
        id=lease.id,
        workspace_id=lease.workspace_id,
        renter_id=lease.renter_id,
        duration_hours=lease.duration_hours,
        gross_amount_usdc=float(lease.gross_amount_usdc),
        platform_fee_2percent=float(lease.platform_fee_2percent),
        net_owner_payout=float(lease.net_owner_payout),
        status=lease.status,
        created_at=lease.created_at.isoformat()
    )

@router.post("/{workspace_id}/stop")
async def stop_workspace(
    workspace_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Stop an active workspace container."""
    stmt = select(WorkspaceContainer).where(WorkspaceContainer.id == workspace_id)
    res = await db.execute(stmt)
    w = res.scalar_one_or_none()

    if not w:
        raise HTTPException(status_code=404, detail="Workspace not found.")

    w.status = "STOPPED"
    await db.commit()
    workspace_service.stop_workspace(workspace_id)

    return {"status": "success", "message": f"Workspace {workspace_id} stopped."}
