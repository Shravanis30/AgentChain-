import uuid
import logging
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.db.session import get_db
from backend.db.models import WorkspaceContainer, WorkspaceLease, WorkspaceUsageRecord, User, Agent, utc_now
from backend.auth_service.rbac import get_current_user
from backend.workspaces.lifecycle import lifecycle_manager, TIER_RESOURCE_LIMITS

logger = logging.getLogger("agentchain.api.workspaces")

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
    docker_container_id: Optional[str] = None
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
    """Deploy an agent to a new virtual workspace container using Docker SDK."""
    # 1. Verify target agent exists
    agent_stmt = select(Agent).where(Agent.id == payload.agent_id)
    agent_res = await db.execute(agent_stmt)
    agent = agent_res.scalar_one_or_none()

    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Agent with ID '{payload.agent_id}' not found."
        )

    ws_id = str(uuid.uuid4())
    tier = payload.resource_tier.upper()
    tier_info = TIER_RESOURCE_LIMITS.get(tier, TIER_RESOURCE_LIMITS["MEDIUM"])

    # 2. Record initial DB state (PROVISIONING)
    ws_obj = WorkspaceContainer(
        id=ws_id,
        owner_id=current_user.id,
        agent_id=payload.agent_id,
        resource_tier=tier,
        pricing_mode=payload.pricing_mode,
        rate_usdc=payload.rate_usdc,
        flat_duration_days=payload.flat_duration_days,
        status="PROVISIONING",
        ram_usage_mb=tier_info["mem_mb"],
        cpu_usage_percent=0.0,
        uptime_seconds=0
    )
    db.add(ws_obj)
    await db.commit()

    # 3. Launch isolated container via Docker SDK
    try:
        container_data = lifecycle_manager.provision_container(
            workspace_id=ws_id,
            agent_id=payload.agent_id,
            resource_tier=tier,
            pricing_mode=payload.pricing_mode,
            rate_usdc=payload.rate_usdc,
            image_tag=None  # Fallback to sandboxed alpine keepalive
        )

        ws_obj.docker_container_id = container_data["container_id"]
        ws_obj.status = "RUNNING"
        await db.commit()
        await db.refresh(ws_obj)

    except Exception as e:
        logger.error(f"Failed to launch Docker workspace container: {e}")
        ws_obj.status = "ERROR"
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to provision Docker container: {str(e)}"
        )

    return WorkspaceResponse(
        id=ws_obj.id,
        owner_id=ws_obj.owner_id,
        agent_id=ws_obj.agent_id,
        resource_tier=ws_obj.resource_tier,
        pricing_mode=ws_obj.pricing_mode,
        rate_usdc=float(ws_obj.rate_usdc),
        status=ws_obj.status,
        docker_container_id=ws_obj.docker_container_id,
        cpu_usage_percent=float(ws_obj.cpu_usage_percent),
        ram_usage_mb=ws_obj.ram_usage_mb,
        uptime_seconds=ws_obj.uptime_seconds,
        created_at=ws_obj.created_at.isoformat()
    )


from datetime import timezone

def get_uptime_seconds(created_at) -> int:
    if not created_at:
        return 0
    now = utc_now()
    c_at = created_at if getattr(created_at, "tzinfo", None) else created_at.replace(tzinfo=timezone.utc)
    return max(0, int((now - c_at).total_seconds()))

@router.get("/me", response_model=List[WorkspaceResponse])
async def get_my_workspaces(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get all deployed workspaces for current logged-in user with live container status."""
    stmt = select(WorkspaceContainer).where(WorkspaceContainer.owner_id == current_user.id).order_by(WorkspaceContainer.created_at.desc())
    res = await db.execute(stmt)
    workspaces = res.scalars().all()

    output = []
    has_updates = False

    for w in workspaces:
        # Reconcile status with real container if supposedly running
        if w.docker_container_id and w.status == "RUNNING":
            insp = lifecycle_manager.inspect_container(w.docker_container_id)
            real_status = insp.get("status", "STOPPED")
            if real_status != "RUNNING":
                w.status = real_status
                has_updates = True
            else:
                # Calculate active uptime seconds
                uptime = get_uptime_seconds(w.created_at)
                w.uptime_seconds = max(w.uptime_seconds, uptime)

        output.append(
            WorkspaceResponse(
                id=w.id,
                owner_id=w.owner_id,
                agent_id=w.agent_id,
                resource_tier=w.resource_tier,
                pricing_mode=w.pricing_mode,
                rate_usdc=float(w.rate_usdc),
                status=w.status,
                docker_container_id=w.docker_container_id,
                cpu_usage_percent=float(w.cpu_usage_percent),
                ram_usage_mb=w.ram_usage_mb,
                uptime_seconds=w.uptime_seconds,
                created_at=w.created_at.isoformat()
            )
        )

    if has_updates:
        await db.commit()

    return output


@router.get("/{workspace_id}", response_model=WorkspaceResponse)
async def get_workspace(
    workspace_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Get workspace details & real-time polled Docker container status."""
    stmt = select(WorkspaceContainer).where(WorkspaceContainer.id == workspace_id)
    res = await db.execute(stmt)
    w = res.scalar_one_or_none()

    if not w:
        raise HTTPException(status_code=404, detail="Workspace container not found.")

    # Poll real Docker container state
    if w.docker_container_id:
        insp = lifecycle_manager.inspect_container(w.docker_container_id)
        real_status = insp.get("status", "STOPPED")

        if real_status != w.status and w.status == "RUNNING":
            w.status = real_status
            await db.commit()

        if real_status == "RUNNING":
            w.uptime_seconds = max(w.uptime_seconds, get_uptime_seconds(w.created_at))

    return WorkspaceResponse(
        id=w.id,
        owner_id=w.owner_id,
        agent_id=w.agent_id,
        resource_tier=w.resource_tier,
        pricing_mode=w.pricing_mode,
        rate_usdc=float(w.rate_usdc),
        status=w.status,
        docker_container_id=w.docker_container_id,
        cpu_usage_percent=float(w.cpu_usage_percent),
        ram_usage_mb=w.ram_usage_mb,
        uptime_seconds=w.uptime_seconds,
        created_at=w.created_at.isoformat()
    )


@router.get("/{workspace_id}/logs")
async def get_workspace_logs(
    workspace_id: str,
    tail: int = Query(100, ge=10, le=1000),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Retrieve raw output execution logs from the workspace container."""
    stmt = select(WorkspaceContainer).where(WorkspaceContainer.id == workspace_id)
    res = await db.execute(stmt)
    w = res.scalar_one_or_none()

    if not w:
        raise HTTPException(status_code=404, detail="Workspace container not found.")

    if not w.docker_container_id:
        return {"logs": "[No container allocated]"}

    logs = lifecycle_manager.get_container_logs(w.docker_container_id, tail=tail)
    return {"workspace_id": workspace_id, "container_id": w.docker_container_id, "logs": logs}


@router.post("/{workspace_id}/stop")
async def stop_workspace(
    workspace_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Stop and remove an active workspace container via Docker SDK."""
    stmt = select(WorkspaceContainer).where(WorkspaceContainer.id == workspace_id)
    res = await db.execute(stmt)
    w = res.scalar_one_or_none()

    if not w:
        raise HTTPException(status_code=404, detail="Workspace not found.")

    # Stop and remove real Docker container
    if w.docker_container_id:
        lifecycle_manager.stop_container(w.docker_container_id, remove=True)

    w.status = "STOPPED"
    await db.commit()

    return {"status": "success", "message": f"Workspace {workspace_id} stopped and container removed."}


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
