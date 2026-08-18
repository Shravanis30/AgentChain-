import uuid
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from sqlalchemy import (
    String, Boolean, DateTime, Integer, Numeric, Text, ForeignKey,
    Index, UniqueConstraint
)
from sqlalchemy.types import JSON
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

class Base(DeclarativeBase):
    """SQLAlchemy 2.0 Declarative Base with universal JSON/UUID mapping."""
    pass

def utc_now() -> datetime:
    return datetime.now(timezone.utc)

# ---------------------------------------------------------------------------
# 1. RBAC: ROLES & PERMISSIONS
# ---------------------------------------------------------------------------

class Permission(Base):
    __tablename__ = "permissions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False) # e.g. "agent:create"
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    category: Mapped[str] = mapped_column(String(50), default="general", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)

    role_permissions: Mapped[List["RolePermission"]] = relationship("RolePermission", back_populates="permission", cascade="all, delete-orphan", lazy="selectin")


class Role(Base):
    __tablename__ = "roles"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False) # SUPER_ADMIN, ADMIN, etc.
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_system: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)

    user_roles: Mapped[List["UserRole"]] = relationship("UserRole", back_populates="role", cascade="all, delete-orphan", lazy="selectin")
    role_permissions: Mapped[List["RolePermission"]] = relationship("RolePermission", back_populates="role", cascade="all, delete-orphan", lazy="selectin")


class RolePermission(Base):
    __tablename__ = "role_permissions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    role_id: Mapped[str] = mapped_column(String(36), ForeignKey("roles.id", ondelete="CASCADE"), nullable=False)
    permission_id: Mapped[str] = mapped_column(String(36), ForeignKey("permissions.id", ondelete="CASCADE"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)

    role: Mapped["Role"] = relationship("Role", back_populates="role_permissions", lazy="selectin")
    permission: Mapped["Permission"] = relationship("Permission", back_populates="role_permissions", lazy="selectin")

    __table_args__ = (UniqueConstraint("role_id", "permission_id", name="uq_role_permission"),)


class UserRole(Base):
    __tablename__ = "user_roles"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role_id: Mapped[str] = mapped_column(String(36), ForeignKey("roles.id", ondelete="CASCADE"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)

    user: Mapped["User"] = relationship("User", back_populates="user_roles", lazy="selectin")
    role: Mapped["Role"] = relationship("Role", back_populates="user_roles", lazy="selectin")

    __table_args__ = (UniqueConstraint("user_id", "role_id", name="uq_user_role"),)


# ---------------------------------------------------------------------------
# 2. USERS, WALLETS & SESSIONS
# ---------------------------------------------------------------------------

class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email: Mapped[Optional[str]] = mapped_column(String(255), unique=True, index=True, nullable=True)
    password_hash: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    full_name: Mapped[str] = mapped_column(String(100), default="AgentChain User", nullable=False)
    avatar_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    user_roles: Mapped[List["UserRole"]] = relationship("UserRole", back_populates="user", cascade="all, delete-orphan", lazy="selectin")
    wallets: Mapped[List["Wallet"]] = relationship("Wallet", back_populates="user", cascade="all, delete-orphan", lazy="selectin")
    sessions: Mapped[List["Session"]] = relationship("Session", back_populates="user", cascade="all, delete-orphan", lazy="selectin")
    agents: Mapped[List["Agent"]] = relationship("Agent", back_populates="owner", cascade="all, delete-orphan", lazy="selectin")
    projects: Mapped[List["Project"]] = relationship("Project", back_populates="creator", cascade="all, delete-orphan", lazy="selectin")
    tasks: Mapped[List["Task"]] = relationship("Task", back_populates="creator", cascade="all, delete-orphan", lazy="selectin")
    ledger_accounts: Mapped[List["LedgerAccount"]] = relationship("LedgerAccount", back_populates="user", lazy="selectin")
    withdrawals: Mapped[List["Withdrawal"]] = relationship("Withdrawal", back_populates="user", lazy="selectin")
    notifications: Mapped[List["Notification"]] = relationship("Notification", back_populates="user", cascade="all, delete-orphan", lazy="selectin")


class Wallet(Base):
    __tablename__ = "wallets"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    address: Mapped[str] = mapped_column(String(42), index=True, nullable=False) # 0x... lowercase
    chain_id: Mapped[int] = mapped_column(Integer, default=137, nullable=False) # Polygon L2 default
    wallet_type: Mapped[str] = mapped_column(String(50), default="eoa", nullable=False) # eoa, smart_contract_wallet
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    verified_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)

    user: Mapped["User"] = relationship("User", back_populates="wallets", lazy="selectin")

    __table_args__ = (
        UniqueConstraint("address", "chain_id", name="uq_wallet_address_chain"),
        Index("idx_wallets_user_id", "user_id"),
    )


class Session(Base):
    __tablename__ = "sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token_hash: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    ip_address: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    auth_method: Mapped[str] = mapped_column(String(50), default="siwe", nullable=False) # siwe, password, oauth
    is_revoked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)

    user: Mapped["User"] = relationship("User", back_populates="sessions", lazy="selectin")

    __table_args__ = (
        Index("idx_sessions_user_revoked", "user_id", "is_revoked"),
    )


# ---------------------------------------------------------------------------
# 3. AGENTS, VERSIONS, PERMISSIONS & VALIDATIONS
# ---------------------------------------------------------------------------

class Agent(Base):
    __tablename__ = "agents"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    owner_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(String(50), index=True, nullable=False) # research, coding, finance, security, devops, etc.
    tags: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, default=list, nullable=True)
    logo_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="DRAFT", index=True, nullable=False) # DRAFT, VALIDATION, TESTING, PENDING_REVIEW, APPROVED, PUBLISHED, PAUSED, SUSPENDED, ARCHIVED
    contract_token_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True) # On-chain ERC-721/DID ID
    price_per_call_usdc: Mapped[float] = mapped_column(Numeric(18, 6), default=0.001, nullable=False)
    pricing_model: Mapped[str] = mapped_column(String(50), default="pay_per_call", nullable=False) # pay_per_call, subscription
    current_version_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)
    published_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    suspended_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    owner: Mapped["User"] = relationship("User", back_populates="agents", lazy="selectin")
    versions: Mapped[List["AgentVersion"]] = relationship("AgentVersion", back_populates="agent", cascade="all, delete-orphan", lazy="selectin")
    tool_permissions: Mapped[List["AgentToolPermission"]] = relationship("AgentToolPermission", back_populates="agent", cascade="all, delete-orphan", lazy="selectin")
    validations: Mapped[List["AgentValidation"]] = relationship("AgentValidation", back_populates="agent", cascade="all, delete-orphan", lazy="selectin")
    reviews: Mapped[List["AgentReview"]] = relationship("AgentReview", back_populates="agent", cascade="all, delete-orphan", lazy="selectin")

    __table_args__ = (
        Index("idx_agents_category_status", "category", "status"),
        Index("idx_agents_owner_status", "owner_id", "status"),
    )


class AgentVersion(Base):
    __tablename__ = "agent_versions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    agent_id: Mapped[str] = mapped_column(String(36), ForeignKey("agents.id", ondelete="CASCADE"), nullable=False)
    version: Mapped[str] = mapped_column(String(20), nullable=False) # v1.0.0 semver
    system_instructions: Mapped[str] = mapped_column(Text, nullable=False)
    model_provider: Mapped[str] = mapped_column(String(50), default="openai", nullable=False)
    model_name: Mapped[str] = mapped_column(String(100), default="gpt-4o", nullable=False)
    temperature: Mapped[float] = mapped_column(Numeric(3, 2), default=0.7, nullable=False)
    max_tokens: Mapped[int] = mapped_column(Integer, default=4096, nullable=False)
    runtime_limits: Mapped[Dict[str, Any]] = mapped_column(JSON, default=lambda: {"timeout_sec": 60, "max_memory_mb": 512}, nullable=False)
    changelog: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)

    agent: Mapped["Agent"] = relationship("Agent", back_populates="versions", lazy="selectin")
    executions: Mapped[List["Execution"]] = relationship("Execution", back_populates="agent_version", lazy="selectin")

    __table_args__ = (
        UniqueConstraint("agent_id", "version", name="uq_agent_version"),
        Index("idx_agent_versions_agent", "agent_id"),
    )


class AgentCredentialReference(Base):
    __tablename__ = "agent_credential_references"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    agent_id: Mapped[str] = mapped_column(String(36), ForeignKey("agents.id", ondelete="CASCADE"), nullable=False)
    key_name: Mapped[str] = mapped_column(String(100), nullable=False) # e.g. "OPENAI_API_KEY"
    vault_secret_path: Mapped[str] = mapped_column(String(255), nullable=False) # Reference in Vault/KMS, NOT plaintext
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)


class AgentToolPermission(Base):
    __tablename__ = "agent_tool_permissions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    agent_id: Mapped[str] = mapped_column(String(36), ForeignKey("agents.id", ondelete="CASCADE"), nullable=False)
    tool_name: Mapped[str] = mapped_column(String(100), nullable=False) # web_search, code_exec, rag_query, etc.
    network_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    filesystem_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    filesystem_write: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    shell_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    database_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    database_write: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    allowed_domains: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, default=list, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)

    agent: Mapped["Agent"] = relationship("Agent", back_populates="tool_permissions", lazy="selectin")


class AgentValidation(Base):
    __tablename__ = "agent_validations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    agent_id: Mapped[str] = mapped_column(String(36), ForeignKey("agents.id", ondelete="CASCADE"), nullable=False)
    version: Mapped[str] = mapped_column(String(20), nullable=False)
    passed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    risk_score: Mapped[int] = mapped_column(Integer, default=0, nullable=False) # 0-100
    checks_performed: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    findings: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, default=list, nullable=True)
    validator_type: Mapped[str] = mapped_column(String(50), default="automated_static_analysis", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)

    agent: Mapped["Agent"] = relationship("Agent", back_populates="validations", lazy="selectin")


class AgentReview(Base):
    __tablename__ = "agent_reviews"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    agent_id: Mapped[str] = mapped_column(String(36), ForeignKey("agents.id", ondelete="CASCADE"), nullable=False)
    reviewer_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    task_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("tasks.id", ondelete="SET NULL"), nullable=True)
    rating: Mapped[int] = mapped_column(Integer, nullable=False) # 1 to 5
    review_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)

    agent: Mapped["Agent"] = relationship("Agent", back_populates="reviews", lazy="selectin")


# ---------------------------------------------------------------------------
# 4. PROJECTS, TASKS, STEPS & ARTIFACTS
# ---------------------------------------------------------------------------

class Project(Base):
    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    created_by: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="active", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    creator: Mapped["User"] = relationship("User", back_populates="projects", lazy="selectin")
    tasks: Mapped[List["Task"]] = relationship("Task", back_populates="project", cascade="all, delete-orphan", lazy="selectin")


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("projects.id", ondelete="SET NULL"), nullable=True)
    created_by: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    user_prompt: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="CREATED", index=True, nullable=False)
    # Status lifecycle: CREATED, QUEUED, PLANNING, WAITING_FOR_APPROVAL, EXECUTING, VERIFYING, SETTLING, COMPLETED, FAILED, CANCELLED, TIMED_OUT, DISPUTED
    budget_usdc: Mapped[float] = mapped_column(Numeric(18, 6), default=1.0, nullable=False)
    escrow_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    idempotency_key: Mapped[Optional[str]] = mapped_column(String(100), unique=True, index=True, nullable=True)
    agent_version_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("agent_versions.id", ondelete="SET NULL"), nullable=True)
    proof_of_task_hash: Mapped[Optional[str]] = mapped_column(String(66), nullable=True) # 0x... 32-byte sha256
    final_output: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    cancelled_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    creator: Mapped["User"] = relationship("User", back_populates="tasks", lazy="selectin")
    project: Mapped[Optional["Project"]] = relationship("Project", back_populates="tasks", lazy="selectin")
    steps: Mapped[List["TaskStep"]] = relationship("TaskStep", back_populates="task", cascade="all, delete-orphan", order_by="TaskStep.step_order", lazy="selectin")
    artifacts: Mapped[List["TaskArtifact"]] = relationship("TaskArtifact", back_populates="task", cascade="all, delete-orphan", lazy="selectin")
    executions: Mapped[List["Execution"]] = relationship("Execution", back_populates="task", cascade="all, delete-orphan", lazy="selectin")
    escrows: Mapped[List["Escrow"]] = relationship("Escrow", back_populates="task", lazy="selectin")
    settlements: Mapped[List["Settlement"]] = relationship("Settlement", back_populates="task", lazy="selectin")
    workflows: Mapped[List["Workflow"]] = relationship("Workflow", back_populates="task", cascade="all, delete-orphan", lazy="selectin")


class TaskStep(Base):
    __tablename__ = "task_steps"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    task_id: Mapped[str] = mapped_column(String(36), ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    step_order: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    domain: Mapped[str] = mapped_column(String(50), nullable=False) # research, coding, finance, security, devops
    assigned_agent_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("agents.id", ondelete="SET NULL"), nullable=True)
    input_prompt: Mapped[str] = mapped_column(Text, nullable=False)
    output_result: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="PENDING", nullable=False) # PENDING, EXECUTING, COMPLETED, FAILED, SKIPPED
    dependencies: Mapped[Dict[str, Any]] = mapped_column(JSON, default=list, nullable=False) # list of step IDs
    tokens_used: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    latency_ms: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    task: Mapped["Task"] = relationship("Task", back_populates="steps", lazy="selectin")


# ---------------------------------------------------------------------------
# 5. DURABLE WORKFLOWS, DAG NODES, JOBS & WORKERS
# ---------------------------------------------------------------------------

class Workflow(Base):
    __tablename__ = "workflows"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    task_id: Mapped[str] = mapped_column(String(36), ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    created_by: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="CREATED", index=True, nullable=False) # CREATED, RUNNING, COMPLETED, FAILED, CANCELLED
    idempotency_key: Mapped[Optional[str]] = mapped_column(String(100), unique=True, index=True, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    task: Mapped["Task"] = relationship("Task", back_populates="workflows", lazy="selectin")
    nodes: Mapped[List["WorkflowNode"]] = relationship("WorkflowNode", back_populates="workflow", cascade="all, delete-orphan", lazy="selectin")
    jobs: Mapped[List["ExecutionJob"]] = relationship("ExecutionJob", back_populates="workflow", cascade="all, delete-orphan", lazy="selectin")


class WorkflowNode(Base):
    __tablename__ = "workflow_nodes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    workflow_id: Mapped[str] = mapped_column(String(36), ForeignKey("workflows.id", ondelete="CASCADE"), nullable=False)
    step_order: Mapped[int] = mapped_column(Integer, nullable=False)
    domain: Mapped[str] = mapped_column(String(50), nullable=False)
    agent_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("agents.id", ondelete="SET NULL"), nullable=True)
    agent_version_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("agent_versions.id", ondelete="SET NULL"), nullable=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    input_prompt: Mapped[str] = mapped_column(Text, nullable=False)
    output_result: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="PENDING", index=True, nullable=False) # PENDING, QUEUED, RUNNING, COMPLETED, FAILED, SKIPPED
    attempt_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    max_attempts: Mapped[int] = mapped_column(Integer, default=3, nullable=False)
    lease_owner: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    lease_expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    tokens_used: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    cost_usdc: Mapped[float] = mapped_column(Numeric(18, 6), default=0.0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    workflow: Mapped["Workflow"] = relationship("Workflow", back_populates="nodes", lazy="selectin")


class WorkflowEdge(Base):
    __tablename__ = "workflow_edges"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    workflow_id: Mapped[str] = mapped_column(String(36), ForeignKey("workflows.id", ondelete="CASCADE"), nullable=False)
    parent_node_id: Mapped[str] = mapped_column(String(36), ForeignKey("workflow_nodes.id", ondelete="CASCADE"), nullable=False)
    child_node_id: Mapped[str] = mapped_column(String(36), ForeignKey("workflow_nodes.id", ondelete="CASCADE"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)


class ExecutionJob(Base):
    __tablename__ = "execution_jobs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    workflow_id: Mapped[str] = mapped_column(String(36), ForeignKey("workflows.id", ondelete="CASCADE"), nullable=False)
    node_id: Mapped[str] = mapped_column(String(36), ForeignKey("workflow_nodes.id", ondelete="CASCADE"), nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="QUEUED", index=True, nullable=False) # QUEUED, LEASED, RUNNING, COMPLETED, FAILED, DLQ
    queue_name: Mapped[str] = mapped_column(String(50), default="default", index=True, nullable=False)
    attempt_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    max_attempts: Mapped[int] = mapped_column(Integer, default=3, nullable=False)
    lease_owner: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    lease_expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    last_error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    workflow: Mapped["Workflow"] = relationship("Workflow", back_populates="jobs", lazy="selectin")


class ExecutionWorker(Base):
    __tablename__ = "execution_workers"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    worker_name: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="READY", nullable=False) # READY, BUSY, DRAINING, STOPPED
    current_job_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    last_heartbeat_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)


class TaskArtifact(Base):
    __tablename__ = "task_artifacts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    task_id: Mapped[str] = mapped_column(String(36), ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    step_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("task_steps.id", ondelete="SET NULL"), nullable=True)
    artifact_name: Mapped[str] = mapped_column(String(255), nullable=False)
    artifact_type: Mapped[str] = mapped_column(String(50), default="code", nullable=False) # code, document, report, json
    content: Mapped[str] = mapped_column(Text, nullable=False)
    s3_storage_key: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    sha256_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)

    task: Mapped["Task"] = relationship("Task", back_populates="artifacts", lazy="selectin")


# ---------------------------------------------------------------------------
# 5. EXECUTIONS & TELEMETRY EVENTS
# ---------------------------------------------------------------------------

class Execution(Base):
    __tablename__ = "executions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    task_id: Mapped[str] = mapped_column(String(36), ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    step_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("task_steps.id", ondelete="SET NULL"), nullable=True)
    agent_version_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("agent_versions.id", ondelete="SET NULL"), nullable=True)
    model_provider: Mapped[str] = mapped_column(String(50), nullable=False)
    model_name: Mapped[str] = mapped_column(String(100), nullable=False)
    prompt_tokens: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    completion_tokens: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_tokens: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    estimated_cost_usd: Mapped[float] = mapped_column(Numeric(10, 6), default=0.0, nullable=False)
    duration_ms: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="SUCCESS", nullable=False) # SUCCESS, FAILED, TIMED_OUT
    error_trace: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)

    task: Mapped["Task"] = relationship("Task", back_populates="executions", lazy="selectin")
    agent_version: Mapped[Optional["AgentVersion"]] = relationship("AgentVersion", back_populates="executions", lazy="selectin")
    events: Mapped[List["ExecutionEvent"]] = relationship("ExecutionEvent", back_populates="execution", cascade="all, delete-orphan", lazy="selectin")


class ExecutionEvent(Base):
    __tablename__ = "execution_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    execution_id: Mapped[str] = mapped_column(String(36), ForeignKey("executions.id", ondelete="CASCADE"), nullable=False)
    event_type: Mapped[str] = mapped_column(String(50), nullable=False) # TOOL_CALL, POLICY_CHECK, TOKEN_TICK, RAG_RETRIEVE, STATUS_UPDATE
    event_payload: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)

    execution: Mapped["Execution"] = relationship("Execution", back_populates="events", lazy="selectin")


# ---------------------------------------------------------------------------
# 6. BLOCKCHAIN, ESCROW, SETTLEMENTS & TRANSACTIONS
# ---------------------------------------------------------------------------

class Escrow(Base):
    __tablename__ = "escrows"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    task_id: Mapped[str] = mapped_column(String(36), ForeignKey("tasks.id", ondelete="RESTRICT"), nullable=False)
    buyer_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    agent_owner_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    client_wallet: Mapped[str] = mapped_column(String(42), nullable=False)
    developer_wallet: Mapped[str] = mapped_column(String(42), nullable=False)
    amount_usdc: Mapped[float] = mapped_column(Numeric(18, 6), nullable=False)
    contract_address: Mapped[str] = mapped_column(String(42), nullable=False)
    escrow_identifier: Mapped[Optional[str]] = mapped_column(String(66), unique=True, index=True, nullable=True) # bytes32 taskId on contract
    deposit_tx_hash: Mapped[Optional[str]] = mapped_column(String(66), unique=True, index=True, nullable=True)
    deposit_block_number: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    settlement_tx_hash: Mapped[Optional[str]] = mapped_column(String(66), unique=True, index=True, nullable=True)
    settlement_block_number: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    refund_tx_hash: Mapped[Optional[str]] = mapped_column(String(66), unique=True, index=True, nullable=True)
    refund_block_number: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    chain_id: Mapped[int] = mapped_column(Integer, default=80002, nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="CREATED", index=True, nullable=False) # CREATED, FUNDED, EXECUTING, COMPLETED, SETTLEMENT_PENDING, SETTLED, REFUND_PENDING, REFUNDED, DISPUTED, CANCELLED, FAILED
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    funded_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    settled_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    refunded_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    task: Mapped["Task"] = relationship("Task", back_populates="escrows", lazy="selectin")
    settlement: Mapped[Optional["Settlement"]] = relationship("Settlement", back_populates="escrow", uselist=False, lazy="selectin")


class IndexerState(Base):
    __tablename__ = "indexer_state"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    chain_id: Mapped[int] = mapped_column(Integer, nullable=False)
    contract_address: Mapped[str] = mapped_column(String(42), nullable=False)
    last_processed_block: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    __table_args__ = (
        UniqueConstraint("chain_id", "contract_address", name="uq_indexer_chain_contract"),
    )


class Settlement(Base):
    __tablename__ = "settlements"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    escrow_id: Mapped[str] = mapped_column(String(36), ForeignKey("escrows.id", ondelete="RESTRICT"), unique=True, nullable=False)
    task_id: Mapped[str] = mapped_column(String(36), ForeignKey("tasks.id", ondelete="RESTRICT"), nullable=False)
    agent_id: Mapped[str] = mapped_column(String(36), ForeignKey("agents.id", ondelete="RESTRICT"), nullable=False)
    gross_amount_usdc: Mapped[float] = mapped_column(Numeric(18, 6), nullable=False)
    developer_amount_usdc: Mapped[float] = mapped_column(Numeric(18, 6), nullable=False) # 85%
    staking_amount_usdc: Mapped[float] = mapped_column(Numeric(18, 6), nullable=False) # 10%
    dao_amount_usdc: Mapped[float] = mapped_column(Numeric(18, 6), nullable=False) # 5%
    proof_hash: Mapped[str] = mapped_column(String(66), nullable=False)
    settlement_tx_hash: Mapped[Optional[str]] = mapped_column(String(66), nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="COMPLETED", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)

    escrow: Mapped["Escrow"] = relationship("Escrow", back_populates="settlement", lazy="selectin")
    task: Mapped["Task"] = relationship("Task", back_populates="settlements", lazy="selectin")


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tx_hash: Mapped[str] = mapped_column(String(66), unique=True, index=True, nullable=False)
    chain_id: Mapped[int] = mapped_column(Integer, default=137, nullable=False)
    from_address: Mapped[str] = mapped_column(String(42), nullable=False)
    to_address: Mapped[str] = mapped_column(String(42), nullable=False)
    tx_type: Mapped[str] = mapped_column(String(50), nullable=False) # ESCROW_LOCK, ESCROW_RELEASE, WITHDRAWAL, STAKING_REWARD
    status: Mapped[str] = mapped_column(String(50), default="CONFIRMED", nullable=False) # PENDING, CONFIRMED, REVERTED
    block_number: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    gas_used: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)


# ---------------------------------------------------------------------------
# 7. DOUBLE-ENTRY FINANCIAL LEDGER & WITHDRAWALS
# ---------------------------------------------------------------------------

class LedgerAccount(Base):
    __tablename__ = "ledger_accounts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    account_type: Mapped[str] = mapped_column(String(50), index=True, nullable=False) # DEVELOPER_EARNINGS, ESCROW_LOCKED, STAKING_POOL, DAO_TREASURY, WITHDRAWALS
    currency: Mapped[str] = mapped_column(String(10), default="USDC", nullable=False)
    balance: Mapped[float] = mapped_column(Numeric(18, 6), default=0.0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    user: Mapped[Optional["User"]] = relationship("User", back_populates="ledger_accounts", lazy="selectin")
    entries: Mapped[List["LedgerEntry"]] = relationship("LedgerEntry", back_populates="account", lazy="selectin")


class LedgerEntry(Base):
    __tablename__ = "ledger_entries"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    account_id: Mapped[str] = mapped_column(String(36), ForeignKey("ledger_accounts.id", ondelete="RESTRICT"), nullable=False)
    reference_id: Mapped[str] = mapped_column(String(36), nullable=False) # Task ID, Escrow ID, or Withdrawal ID
    entry_type: Mapped[str] = mapped_column(String(50), nullable=False) # CREDIT, DEBIT
    amount: Mapped[float] = mapped_column(Numeric(18, 6), nullable=False)
    balance_after: Mapped[float] = mapped_column(Numeric(18, 6), nullable=False)
    description: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)

    account: Mapped["LedgerAccount"] = relationship("LedgerAccount", back_populates="entries", lazy="selectin")


class Withdrawal(Base):
    __tablename__ = "withdrawals"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    destination_wallet: Mapped[str] = mapped_column(String(42), nullable=False)
    amount_usdc: Mapped[float] = mapped_column(Numeric(18, 6), nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="PENDING", index=True, nullable=False) # PENDING, APPROVED, PROCESSING, COMPLETED, REJECTED
    tx_hash: Mapped[Optional[str]] = mapped_column(String(66), nullable=True)
    risk_score: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    admin_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped["User"] = relationship("User", back_populates="withdrawals", lazy="selectin")


class Dispute(Base):
    __tablename__ = "disputes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    task_id: Mapped[str] = mapped_column(String(36), ForeignKey("tasks.id", ondelete="RESTRICT"), nullable=False)
    raised_by: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="OPEN", nullable=False) # OPEN, UNDER_REVIEW, RESOLVED_REFUND, RESOLVED_PAYOUT
    resolution_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)


# ---------------------------------------------------------------------------
# 8. AUDIT LOGS, NOTIFICATIONS & SECURITY EVENTS
# ---------------------------------------------------------------------------

class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    notification_type: Mapped[str] = mapped_column(String(50), default="info", nullable=False) # info, success, warning, error
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)

    user: Mapped["User"] = relationship("User", back_populates="notifications", lazy="selectin")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    actor_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    action: Mapped[str] = mapped_column(String(100), index=True, nullable=False) # USER_LOGIN, AGENT_CREATED, ESCROW_RELEASED, etc.
    resource_type: Mapped[str] = mapped_column(String(50), nullable=False) # user, agent, task, escrow, admin
    resource_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    ip_address: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    details: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, index=True, nullable=False)

    __table_args__ = (
        Index("idx_audit_logs_actor_action", "actor_id", "action"),
    )


class SecurityEvent(Base):
    __tablename__ = "security_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    event_type: Mapped[str] = mapped_column(String(100), index=True, nullable=False) # PROMPT_INJECTION_ATTEMPT, BRUTE_FORCE, UNAUTHORIZED_TOOL_CALL, HIGH_RISK_ACTION
    severity: Mapped[str] = mapped_column(String(20), default="HIGH", nullable=False) # LOW, MEDIUM, HIGH, CRITICAL
    actor_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    ip_address: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    raw_payload: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    mitigated: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, index=True, nullable=False)


# ---------------------------------------------------------------------------
# PHASE 6: WORKSPACE CONTAINER HOSTING, LEASES & METERING
# ---------------------------------------------------------------------------

class WorkspaceContainer(Base):
    __tablename__ = "workspace_containers"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    owner_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    agent_id: Mapped[str] = mapped_column(String(36), ForeignKey("agents.id", ondelete="CASCADE"), nullable=False)
    resource_tier: Mapped[str] = mapped_column(String(20), default="MEDIUM", nullable=False) # SMALL, MEDIUM, LARGE
    pricing_mode: Mapped[str] = mapped_column(String(20), default="PER_HOUR", nullable=False) # PER_HOUR, PER_DAY, CUSTOM_FLAT
    rate_usdc: Mapped[float] = mapped_column(Numeric(12, 4), default=15.00, nullable=False)
    flat_duration_days: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="RUNNING", nullable=False) # PROVISIONING, RUNNING, STOPPED, FLAGGED, TERMINATED
    docker_container_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    cpu_usage_percent: Mapped[float] = mapped_column(Numeric(5, 2), default=12.5, nullable=False)
    ram_usage_mb: Mapped[int] = mapped_column(Integer, default=2048, nullable=False)
    uptime_seconds: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    owner: Mapped["User"] = relationship("User", lazy="selectin")
    agent: Mapped["Agent"] = relationship("Agent", lazy="selectin")


class WorkspaceLease(Base):
    __tablename__ = "workspace_leases"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    workspace_id: Mapped[str] = mapped_column(String(36), ForeignKey("workspace_containers.id", ondelete="CASCADE"), nullable=False)
    renter_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    duration_hours: Mapped[int] = mapped_column(Integer, nullable=False)
    gross_amount_usdc: Mapped[float] = mapped_column(Numeric(12, 4), nullable=False)
    platform_fee_2percent: Mapped[float] = mapped_column(Numeric(12, 4), nullable=False)
    net_owner_payout: Mapped[float] = mapped_column(Numeric(12, 4), nullable=False)
    tx_hash: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="ACTIVE", nullable=False) # ACTIVE, COMPLETED, REFUNDED
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)


class WorkspaceUsageRecord(Base):
    __tablename__ = "workspace_usage_records"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    workspace_id: Mapped[str] = mapped_column(String(36), ForeignKey("workspace_containers.id", ondelete="CASCADE"), nullable=False)
    owner_id: Mapped[str] = mapped_column(String(36), nullable=False)
    billing_period_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    billing_period_end: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    elapsed_seconds: Mapped[int] = mapped_column(Integer, nullable=False)
    pricing_mode: Mapped[str] = mapped_column(String(20), nullable=False)
    billed_amount_usdc: Mapped[float] = mapped_column(Numeric(12, 4), nullable=False)
    platform_fee_usdc: Mapped[float] = mapped_column(Numeric(12, 4), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)

