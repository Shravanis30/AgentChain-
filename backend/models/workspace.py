"""Workspace data models and schemas."""
from typing import Optional
from pydantic import BaseModel, Field

from backend.db.models import (
    WorkspaceContainer,
    WorkspaceLease,
    WorkspaceUsageRecord,
)

# Alias for standard model naming convention
Workspace = WorkspaceContainer

class WorkspaceCreate(BaseModel):
    agent_id: str
    resource_tier: str = Field("MEDIUM", description="SMALL, MEDIUM, or LARGE")
    pricing_mode: str = Field("PER_HOUR", description="PER_HOUR, PER_DAY, or CUSTOM_FLAT")
    rate_usdc: float = Field(15.00, ge=0.1)
    flat_duration_days: Optional[int] = None

class WorkspaceDetails(BaseModel):
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

__all__ = [
    "Workspace",
    "WorkspaceContainer",
    "WorkspaceLease",
    "WorkspaceUsageRecord",
    "WorkspaceCreate",
    "WorkspaceDetails",
]
