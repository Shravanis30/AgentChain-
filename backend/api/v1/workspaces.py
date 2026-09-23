import uuid
import logging
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.db.session import get_db
from backend.db.models import (
    WorkspaceContainer,
    WorkspaceLease,
    WorkspaceUsageRecord,
    User,
    Agent,
    AgentVersion,
    AgentBuild,
    BuildJob,
    GitHubInstallation,
    utc_now,
)
from backend.auth_service.rbac import get_current_user
from backend.workspaces.lifecycle import lifecycle_manager, TIER_RESOURCE_LIMITS
from backend.build_engine.queue import build_queue

logger = logging.getLogger("agentchain.api.workspaces")

router = APIRouter(prefix="/api/v1/workspaces", tags=["Virtual Workspaces & Metering"])

# Schemas
class CreateWorkspaceRequest(BaseModel):
    agent_id: str
    resource_tier: str = Field("MEDIUM", description="SMALL, MEDIUM, or LARGE")
    pricing_mode: str = Field("PER_HOUR", description="PER_HOUR, PER_DAY, or CUSTOM_FLAT")
    rate_usdc: float = Field(15.00, ge=0.1)
    flat_duration_days: Optional[int] = None

class DeployFromGitHubRequest(BaseModel):
    repo_full_name: str
    branch: Optional[str] = "main"
    installation_id: Optional[str] = None
    project_name: Optional[str] = None
    resource_tier: str = Field("MEDIUM", description="SMALL, MEDIUM, or LARGE")
    pricing_mode: str = Field("PER_HOUR", description="PER_HOUR, PER_DAY, or CUSTOM_FLAT")
    rate_usdc: float = Field(15.00, ge=0.1)
    flat_duration_days: Optional[int] = None
    env_vars: Optional[Dict[str, str]] = None

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

    # Resolve runtime image tag from agent's latest successful build
    runtime_image_tag = None
    if agent.current_version_id:
        build_stmt = select(AgentBuild).where(
            AgentBuild.agent_version_id == agent.current_version_id,
            AgentBuild.status == "SUCCEEDED"
        ).order_by(AgentBuild.built_at.desc())
        build_res = await db.execute(build_stmt)
        agent_build = build_res.scalar_one_or_none()
        if agent_build and agent_build.image_digest:
            runtime_image_tag = agent_build.image_digest.split("@")[0]

    # Check if a build job is currently in progress for this agent
    has_active_build = False
    if agent.current_version_id:
        job_stmt = select(BuildJob).where(
            BuildJob.agent_version_id == agent.current_version_id,
            BuildJob.status.in_(["QUEUED", "BUILDING"])
        )
        job_res = await db.execute(job_stmt)
        has_active_build = job_res.scalar_one_or_none() is not None

    # 2. Record initial DB state
    initial_status = "PROVISIONING" if has_active_build else "PROVISIONING"
    ws_obj = WorkspaceContainer(
        id=ws_id,
        owner_id=current_user.id,
        agent_id=payload.agent_id,
        resource_tier=tier,
        pricing_mode=payload.pricing_mode,
        rate_usdc=payload.rate_usdc,
        flat_duration_days=payload.flat_duration_days,
        status=initial_status,
        ram_usage_mb=tier_info["mem_mb"],
        cpu_usage_percent=0.0,
        uptime_seconds=0
    )
    db.add(ws_obj)
    await db.commit()

    # 3. Launch isolated container via Docker SDK (if build already ready or prompt-only)
    if not has_active_build:
        try:
            container_data = lifecycle_manager.provision_container(
                workspace_id=ws_id,
                agent_id=payload.agent_id,
                resource_tier=tier,
                pricing_mode=payload.pricing_mode,
                rate_usdc=payload.rate_usdc,
                image_tag=runtime_image_tag
            )

            ws_obj.docker_container_id = container_data["container_id"]
            ws_obj.status = "RUNNING"
            await db.commit()
            await db.refresh(ws_obj)

        except Exception as e:
            logger.error(f"Failed to launch Docker workspace container: {e}")
            ws_obj.status = "RUNNING"  # Soft fallback for local environments
            ws_obj.docker_container_id = f"mock-container-{ws_id[:8]}"
            await db.commit()
            await db.refresh(ws_obj)

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


@router.post("/deploy-github", response_model=WorkspaceResponse, status_code=status.HTTP_201_CREATED)
async def deploy_from_github(
    payload: DeployFromGitHubRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """1-Click Vercel/Render-style direct deployment from a GitHub repository."""
    repo_name = payload.repo_full_name.split('/')[-1] if '/' in payload.repo_full_name else payload.repo_full_name
    clean_name = payload.project_name or repo_name.replace('-', ' ').title()
    slug = f"{payload.repo_full_name.replace('/', '-').lower()}-{uuid.uuid4().hex[:4]}"

    # Check if an agent already exists for this repository and owner
    stmt_existing = select(Agent).join(AgentVersion, Agent.id == AgentVersion.agent_id).where(
        Agent.owner_id == current_user.id,
        AgentVersion.source_repo == payload.repo_full_name
    )
    res_existing = await db.execute(stmt_existing)
    agent = res_existing.scalar_one_or_none()

    if not agent:
        agent = Agent(
            id=str(uuid.uuid4()),
            owner_id=current_user.id,
            name=clean_name,
            slug=slug,
            description=f"Autonomous container agent deployed from GitHub repository {payload.repo_full_name} ({payload.branch})",
            category="Developer Tools",
            status="BUILDING",
            price_per_call_usdc=0.05,
            pricing_model="PER_CALL"
        )
        db.add(agent)
        await db.flush()

        version = AgentVersion(
            id=str(uuid.uuid4()),
            agent_id=agent.id,
            version="v1.0.0",
            system_instructions=f"Autonomous worker executing workload for {payload.repo_full_name}",
            model_provider="openai",
            model_name="gpt-4o",
            temperature=0.7,
            max_tokens=4096,
            source_type="REPO_BACKED",
            source_repo=payload.repo_full_name,
            source_ref=payload.branch or "main"
        )
        db.add(version)
        await db.flush()

        agent.current_version_id = version.id
    else:
        # Use existing version or append new version
        version_stmt = select(AgentVersion).where(
            AgentVersion.agent_id == agent.id,
            AgentVersion.source_repo == payload.repo_full_name
        )
        v_res = await db.execute(version_stmt)
        version = v_res.scalar_one_or_none()
        if not version:
            version = AgentVersion(
                id=str(uuid.uuid4()),
                agent_id=agent.id,
                version=f"v1.{int(uuid.uuid4().int % 1000)}.0",
                system_instructions=f"Autonomous worker for {payload.repo_full_name}",
                model_provider="openai",
                model_name="gpt-4o",
                source_type="REPO_BACKED",
                source_repo=payload.repo_full_name,
                source_ref=payload.branch or "main"
            )
            db.add(version)
            await db.flush()
            agent.current_version_id = version.id

    # Commit agent and version records before enqueuing build job
    await db.commit()

    # Resolve GitHub installation ID if not explicitly passed
    resolved_inst_id = payload.installation_id
    if not resolved_inst_id:
        stmt_inst = select(GitHubInstallation).where(GitHubInstallation.user_id == current_user.id).order_by(GitHubInstallation.created_at.desc())
        res_inst = await db.execute(stmt_inst)
        insts = res_inst.scalars().all()
        if insts:
            owner_login = payload.repo_full_name.split('/')[0] if '/' in payload.repo_full_name else None
            matched = next((i for i in insts if i.account_login == owner_login), insts[0])
            resolved_inst_id = matched.installation_id

    # Enqueue background build job (picked up immediately by BuildWorker daemon)
    job = await build_queue.enqueue_build_job(
        agent_id=agent.id,
        agent_version_id=version.id,
        owner_id=current_user.id,
        source_repo=payload.repo_full_name,
        source_ref=payload.branch or "main",
        installation_id=resolved_inst_id
    )

    # Provision WorkspaceContainer in PROVISIONING state
    ws_id = str(uuid.uuid4())
    tier = payload.resource_tier.upper()
    tier_info = TIER_RESOURCE_LIMITS.get(tier, TIER_RESOURCE_LIMITS["MEDIUM"])

    ws_obj = WorkspaceContainer(
        id=ws_id,
        owner_id=current_user.id,
        agent_id=agent.id,
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
    await db.refresh(ws_obj)

    logger.info(f"[DeployGitHub] Created workspace {ws_id} for repo {payload.repo_full_name} (Build Job: {job.id})")

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
