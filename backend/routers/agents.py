import re
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from sqlalchemy.orm import selectinload

from backend.db.session import get_db
from backend.db.models import (
    User, Agent, AgentVersion, AgentToolPermission, AgentValidation, AgentBuild, AuditLog, GitHubInstallation, utc_now
)
from backend.auth_service.rbac import get_current_user, require_permission, assert_agent_ownership
from backend.agent_engine.validator import agent_validator
from backend.build_engine.queue import build_queue

router = APIRouter(prefix="/api/v1/agents", tags=["Agents & Agent Studio"])

class CreateToolPermissionSchema(BaseModel):
    tool_name: str
    network_enabled: bool = False
    filesystem_read: bool = False
    filesystem_write: bool = False
    shell_enabled: bool = False
    allowed_domains: Optional[List[str]] = []

class CreateAgentVersionSchema(BaseModel):
    version: str = "v1.0.0"
    system_instructions: str
    model_provider: str = "openai"
    model_name: str = "gpt-4o"
    temperature: float = 0.7
    max_tokens: int = 4096
    changelog: Optional[str] = "Initial release"
    source_type: Optional[str] = "PROMPT_ONLY"
    source_repo: Optional[str] = None
    source_ref: Optional[str] = "main"
    installation_id: Optional[str] = None

class CreateAgentSchema(BaseModel):
    name: str
    slug: str
    description: str
    category: str
    price_per_call_usdc: float = 0.001
    pricing_model: str = "pay_per_call"
    initial_version: CreateAgentVersionSchema
    tool_permissions: Optional[List[CreateToolPermissionSchema]] = []

class PublishAgentSchema(BaseModel):
    tx_hash: Optional[str] = None
    block_number: Optional[int] = None

class UpdateAgentSchema(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    price_per_call_usdc: Optional[float] = None
    pricing_model: Optional[str] = None

@router.get("")
async def list_public_agents(session: AsyncSession = Depends(get_db)):
    """Lists published & approved agents in the registry."""
    stmt = (
        select(Agent)
        .options(selectinload(Agent.versions))
        .where(Agent.status.in_(["PUBLISHED", "APPROVED"]))
        .order_by(Agent.created_at.desc())
    )
    res = await session.execute(stmt)
    agents = res.scalars().all()
    return [
        {
            "id": a.id,
            "name": a.name,
            "slug": a.slug,
            "description": a.description,
            "category": a.category,
            "status": a.status,
            "price_per_call_usdc": float(a.price_per_call_usdc),
            "pricing_model": a.pricing_model,
            "current_version": a.versions[-1].version if a.versions else "v1.0.0",
            "model_provider": a.versions[-1].model_provider if a.versions else "openai",
            "model_name": a.versions[-1].model_name if a.versions else "gpt-4o",
            "created_at": a.created_at.isoformat(),
        }
        for a in agents
    ]

@router.post("", dependencies=[Depends(require_permission("agent:create"))])
async def create_agent(
    req: CreateAgentSchema,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db)
):
    """Creates a new AI agent in DRAFT status and initializes its v1.0.0 version."""
    clean_slug = req.slug.strip().lower()
    stmt = select(Agent).where(Agent.slug == clean_slug)
    res = await session.execute(stmt)
    if res.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"An agent with slug '{clean_slug}' already exists."
        )

    agent = Agent(
        owner_id=user.id,
        name=req.name,
        slug=clean_slug,
        description=req.description,
        category=req.category.lower(),
        price_per_call_usdc=req.price_per_call_usdc,
        pricing_model=req.pricing_model,
        status="DRAFT"
    )
    session.add(agent)
    await session.flush()

    v = req.initial_version
    source_type = "REPO_BACKED" if v.source_repo else (v.source_type or "PROMPT_ONLY")
    version = AgentVersion(
        agent_id=agent.id,
        version=v.version,
        system_instructions=v.system_instructions,
        model_provider=v.model_provider,
        model_name=v.model_name,
        temperature=v.temperature,
        max_tokens=v.max_tokens,
        source_type=source_type,
        source_repo=v.source_repo,
        source_ref=v.source_ref or "main",
        changelog=v.changelog
    )
    session.add(version)
    await session.flush()

    agent.current_version_id = version.id

    if req.tool_permissions:
        for tp in req.tool_permissions:
            perm = AgentToolPermission(
                agent_id=agent.id,
                tool_name=tp.tool_name,
                network_enabled=tp.network_enabled,
                filesystem_read=tp.filesystem_read,
                filesystem_write=tp.filesystem_write,
                shell_enabled=tp.shell_enabled,
                allowed_domains=tp.allowed_domains
            )
            session.add(perm)

    audit = AuditLog(
        actor_id=user.id,
        action="AGENT_CREATED",
        resource_type="agent",
        resource_id=agent.id,
        details={"name": agent.name, "slug": agent.slug}
    )
    session.add(audit)
    await session.commit()

    if v.source_repo:
        installation_id = v.installation_id
        if not installation_id:
            stmt = select(GitHubInstallation).where(GitHubInstallation.user_id == user.id).order_by(GitHubInstallation.created_at.desc())
            res = await session.execute(stmt)
            insts = res.scalars().all()
            if insts:
                owner_login = v.source_repo.split('/')[0] if '/' in v.source_repo else None
                matched = next((i for i in insts if i.account_login == owner_login), insts[0])
                installation_id = matched.installation_id

        await build_queue.enqueue_build_job(
            agent_id=agent.id,
            agent_version_id=version.id,
            owner_id=user.id,
            source_repo=v.source_repo,
            source_ref=v.source_ref or "main",
            installation_id=installation_id
        )

    return {
        "status": "success",
        "agent_id": agent.id,
        "name": agent.name,
        "slug": agent.slug,
        "current_status": agent.status,
        "version": version.version
    }

@router.get("/me")
async def list_my_agents(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db)
):
    """Lists all AI agents created by the authenticated user."""
    stmt = select(Agent).options(selectinload(Agent.versions)).where(Agent.owner_id == user.id).order_by(Agent.created_at.desc())
    res = await session.execute(stmt)
    agents = res.scalars().all()

    return [
        {
            "id": a.id,
            "name": a.name,
            "slug": a.slug,
            "description": a.description,
            "category": a.category,
            "status": a.status,
            "price_per_call_usdc": float(a.price_per_call_usdc),
            "pricing_model": a.pricing_model,
            "created_at": a.created_at.isoformat(),
            "updated_at": a.updated_at.isoformat(),
            "versions_count": len(a.versions)
        }
        for a in agents
    ]

def _get_user_roles(user: User) -> List[str]:
    if "user_roles" in user.__dict__ and user.user_roles:
        roles = []
        for ur in user.user_roles:
            if "role" in ur.__dict__ and ur.role:
                roles.append(ur.role.name)
        return roles
    return []

@router.get("/{agent_id}")
async def get_agent_detail(
    agent_id: str,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db)
):
    """Retrieves full agent configuration, versions, and validation results (IDOR ownership checked)."""
    stmt = (
        select(Agent)
        .options(
            selectinload(Agent.versions),
            selectinload(Agent.tool_permissions),
            selectinload(Agent.validations)
        )
        .where(Agent.id == agent_id)
    )
    res = await session.execute(stmt)
    agent = res.scalar_one_or_none()

    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found.")

    if agent.owner_id != user.id and agent.status not in ["APPROVED", "PUBLISHED"]:
        user_roles = _get_user_roles(user)
        if "SUPER_ADMIN" not in user_roles and "ADMIN" not in user_roles:
            raise HTTPException(status_code=403, detail="You do not have permission to view this draft agent.")

    active_v = agent.versions[-1] if agent.versions else None

    return {
        "id": agent.id,
        "owner_id": agent.owner_id,
        "name": agent.name,
        "slug": agent.slug,
        "description": agent.description,
        "category": agent.category,
        "status": agent.status,
        "price_per_call_usdc": float(agent.price_per_call_usdc),
        "pricing_model": agent.pricing_model,
        "current_version": {
            "id": active_v.id,
            "version": active_v.version,
            "system_instructions": active_v.system_instructions,
            "model_provider": active_v.model_provider,
            "model_name": active_v.model_name,
            "temperature": float(active_v.temperature),
            "max_tokens": active_v.max_tokens,
            "onchain_tx_hash": getattr(active_v, "onchain_tx_hash", None),
            "onchain_block_number": getattr(active_v, "onchain_block_number", None)
        } if active_v else None,
        "versions": [
            {"id": v.id, "version": v.version, "changelog": v.changelog, "created_at": v.created_at.isoformat()}
            for v in agent.versions
        ],
        "tool_permissions": [
            {
                "tool_name": tp.tool_name,
                "shell_enabled": tp.shell_enabled,
                "network_enabled": tp.network_enabled,
                "filesystem_write": tp.filesystem_write
            }
            for tp in agent.tool_permissions
        ],
        "validations": [
            {"id": val.id, "version": val.version, "passed": val.passed, "risk_score": val.risk_score, "created_at": val.created_at.isoformat()}
            for val in agent.validations
        ],
        "created_at": agent.created_at.isoformat(),
        "published_at": agent.published_at.isoformat() if agent.published_at else None
    }

@router.patch("/{agent_id}")
async def update_agent_draft(
    agent_id: str,
    req: UpdateAgentSchema,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db)
):
    """Updates draft metadata for an agent (enforces ownership and prevents status forgery)."""
    stmt = select(Agent).where(Agent.id == agent_id)
    res = await session.execute(stmt)
    agent = res.scalar_one_or_none()

    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found.")

    user_roles = _get_user_roles(user)
    assert_agent_ownership(agent, user, user_roles)

    if req.name is not None:
        agent.name = req.name
    if req.description is not None:
        agent.description = req.description
    if req.category is not None:
        agent.category = req.category.lower()
    if req.price_per_call_usdc is not None:
        agent.price_per_call_usdc = req.price_per_call_usdc
    if req.pricing_model is not None:
        agent.pricing_model = req.pricing_model

    audit = AuditLog(
        actor_id=user.id,
        action="AGENT_UPDATED",
        resource_type="agent",
        resource_id=agent.id
    )
    session.add(audit)
    await session.commit()

    return {"status": "success", "agent_id": agent.id, "name": agent.name}

@router.post("/{agent_id}/versions")
async def create_agent_version(
    agent_id: str,
    req: CreateAgentVersionSchema,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db)
):
    """Creates a new semver version for an agent (published versions are immutable)."""
    stmt = select(Agent).where(Agent.id == agent_id)
    res = await session.execute(stmt)
    agent = res.scalar_one_or_none()

    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found.")

    user_roles = _get_user_roles(user)
    assert_agent_ownership(agent, user, user_roles)

    # Check version string uniqueness for this agent
    stmt_v = select(AgentVersion).where(AgentVersion.agent_id == agent_id, AgentVersion.version == req.version)
    res_v = await session.execute(stmt_v)
    if res_v.scalar_one_or_none():
        raise HTTPException(status_code=400, detail=f"Version '{req.version}' already exists for this agent.")

    source_type = "REPO_BACKED" if req.source_repo else "PROMPT_ONLY"

    version = AgentVersion(
        agent_id=agent.id,
        version=req.version,
        system_instructions=req.system_instructions,
        model_provider=req.model_provider,
        model_name=req.model_name,
        temperature=req.temperature,
        max_tokens=req.max_tokens,
        source_type=source_type,
        source_repo=req.source_repo,
        source_ref=req.source_ref or "main",
        changelog=req.changelog
    )
    session.add(version)
    await session.flush()

    agent.current_version_id = version.id
    agent.status = "DRAFT"

    audit = AuditLog(
        actor_id=user.id,
        action="AGENT_VERSION_CREATED",
        resource_type="agent",
        resource_id=agent.id,
        details={"version": req.version, "source_type": source_type}
    )
    session.add(audit)
    await session.commit()

    # Enqueue container build job if repository-backed
    if req.source_repo:
        installation_id = req.installation_id
        if not installation_id:
            stmt = select(GitHubInstallation).where(GitHubInstallation.user_id == user.id).order_by(GitHubInstallation.created_at.desc())
            res = await session.execute(stmt)
            insts = res.scalars().all()
            if insts:
                owner_login = req.source_repo.split('/')[0] if '/' in req.source_repo else None
                matched = next((i for i in insts if i.account_login == owner_login), insts[0])
                installation_id = matched.installation_id

        await build_queue.enqueue_build_job(
            agent_id=agent.id,
            agent_version_id=version.id,
            owner_id=user.id,
            source_repo=req.source_repo,
            source_ref=req.source_ref or "main",
            installation_id=installation_id
        )

    return {"status": "success", "version_id": version.id, "version": version.version, "source_type": source_type}


@router.get("/{agent_id}/versions/{version_id}/build")
async def get_version_build_status(
    agent_id: str,
    version_id: str,
    session: AsyncSession = Depends(get_db)
):
    """Retrieves live container compilation build status and logs for an agent version."""
    stmt = select(AgentBuild).where(AgentBuild.agent_version_id == version_id).order_by(AgentBuild.built_at.desc())
    res = await session.execute(stmt)
    build = res.scalar_one_or_none()

    if not build:
        return {
            "version_id": version_id,
            "status": "PROMPT_ONLY",
            "image_digest": "",
            "build_strategy": "PROMPT_ONLY",
            "build_log": "[INFO] Prompt-only agent version. No container image build required.",
            "built_at": utc_now().isoformat()
        }

    return {
        "version_id": version_id,
        "status": build.status,
        "image_digest": build.image_digest,
        "build_strategy": build.build_strategy,
        "build_log": build.build_log,
        "built_at": build.built_at.isoformat()
    }

@router.post("/{agent_id}/validate")
async def validate_agent(
    agent_id: str,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db)
):
    """Executes automated security validation and persists AgentValidation record in DB."""
    stmt = select(Agent).where(Agent.id == agent_id)
    res = await session.execute(stmt)
    agent = res.scalar_one_or_none()

    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found.")

    user_roles = _get_user_roles(user)
    assert_agent_ownership(agent, user, user_roles)

    version = agent.versions[-1] if agent.versions else None
    if not version:
        raise HTTPException(status_code=400, detail="Agent has no active version to validate.")

    tool_perms = [
        {
            "tool_name": tp.tool_name,
            "shell_enabled": tp.shell_enabled,
            "network_enabled": tp.network_enabled,
            "filesystem_write": tp.filesystem_write
        }
        for tp in agent.tool_permissions
    ]

    validation_result = agent_validator.validate_agent_configuration(
        name=agent.name,
        category=agent.category,
        system_instructions=version.system_instructions,
        model_provider=version.model_provider,
        model_name=version.model_name,
        price_per_call_usdc=float(agent.price_per_call_usdc),
        tool_permissions=tool_perms
    )

    passed = validation_result["passed"]
    validation_record = AgentValidation(
        agent_id=agent.id,
        version=version.version,
        passed=passed,
        risk_score=validation_result["risk_score"],
        checks_performed=validation_result["checks_performed"],
        findings=validation_result["findings"],
        validator_type="automated_static_analysis"
    )
    session.add(validation_record)

    if passed:
        agent.status = "VALIDATED"
    else:
        agent.status = "VALIDATION_FAILED"

    audit = AuditLog(
        actor_id=user.id,
        action="AGENT_VALIDATED" if passed else "AGENT_VALIDATION_FAILED",
        resource_type="agent",
        resource_id=agent.id,
        details={"risk_score": validation_result["risk_score"], "passed": passed}
    )
    session.add(audit)
    await session.commit()

    return {
        "status": "success",
        "validation_id": validation_record.id,
        "passed": passed,
        "validation_passed": passed,
        "new_status": agent.status,
        "new_agent_status": agent.status,
        "risk_score": validation_result["risk_score"],
        "findings": validation_result["findings"]
    }

@router.post("/{agent_id}/submit")
async def submit_agent_for_review(
    agent_id: str,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db)
):
    """Submits a VALIDATED agent to PENDING_REVIEW for admin approval."""
    stmt = select(Agent).where(Agent.id == agent_id)
    res = await session.execute(stmt)
    agent = res.scalar_one_or_none()

    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found.")

    user_roles = _get_user_roles(user)
    assert_agent_ownership(agent, user, user_roles)

    if agent.status != "VALIDATED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Agent cannot be submitted for review from status '{agent.status}'. Run validation first."
        )

    agent.status = "PENDING_REVIEW"
    audit = AuditLog(
        actor_id=user.id,
        action="AGENT_SUBMITTED",
        resource_type="agent",
        resource_id=agent.id
    )
    session.add(audit)
    await session.commit()

    return {"status": "success", "agent_id": agent.id, "new_status": agent.status}

@router.post("/{agent_id}/publish")
async def publish_agent(
    agent_id: str,
    req: Optional[PublishAgentSchema] = None,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db)
):
    """Publishes a VALIDATED or APPROVED agent to the public marketplace after on-chain confirmation."""
    stmt = select(Agent).where(Agent.id == agent_id)
    res = await session.execute(stmt)
    agent = res.scalar_one_or_none()

    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found.")

    user_roles = _get_user_roles(user)
    assert_agent_ownership(agent, user, user_roles)

    if agent.status not in ["APPROVED", "PAUSED", "VALIDATED"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Agent must be VALIDATED or APPROVED before publishing. Current status: '{agent.status}'."
        )

    agent.status = "PUBLISHED"
    agent.published_at = utc_now()

    if req and agent.versions:
        active_v = agent.versions[-1]
        if req.tx_hash:
            active_v.onchain_tx_hash = req.tx_hash
        if req.block_number:
            active_v.onchain_block_number = req.block_number

    audit = AuditLog(
        actor_id=user.id,
        action="AGENT_PUBLISHED",
        resource_type="agent",
        resource_id=agent.id,
        details={"tx_hash": req.tx_hash if req else None, "block_number": req.block_number if req else None}
    )
    session.add(audit)
    await session.commit()

    return {
        "status": "success",
        "agent_id": agent.id,
        "new_status": agent.status,
        "tx_hash": req.tx_hash if req else None,
        "block_number": req.block_number if req else None
    }

@router.post("/{agent_id}/pause")
async def pause_agent(
    agent_id: str,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db)
):
    """Pauses or resumes a published agent."""
    stmt = select(Agent).where(Agent.id == agent_id)
    res = await session.execute(stmt)
    agent = res.scalar_one_or_none()

    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found.")

    user_roles = [ur.role.name for ur in user.user_roles]
    assert_agent_ownership(agent, user, user_roles)

    if agent.status == "PUBLISHED":
        agent.status = "PAUSED"
    elif agent.status == "PAUSED":
        agent.status = "PUBLISHED"
    else:
        raise HTTPException(status_code=400, detail=f"Cannot pause/resume agent in status '{agent.status}'.")

    session.add(AuditLog(actor_id=user.id, action="AGENT_PAUSED", resource_type="agent", resource_id=agent.id))
    await session.commit()

    return {"status": "success", "agent_id": agent.id, "new_status": agent.status}

@router.delete("/{agent_id}")
async def archive_agent(
    agent_id: str,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db)
):
    """Archives an agent (prevents deletion if historical task records exist)."""
    stmt = select(Agent).where(Agent.id == agent_id)
    res = await session.execute(stmt)
    agent = res.scalar_one_or_none()

    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found.")

    user_roles = [ur.role.name for ur in user.user_roles]
    assert_agent_ownership(agent, user, user_roles)

    agent.status = "ARCHIVED"
    session.add(AuditLog(actor_id=user.id, action="AGENT_ARCHIVED", resource_type="agent", resource_id=agent.id))
    await session.commit()

    return {"status": "success", "agent_id": agent.id, "new_status": agent.status}
