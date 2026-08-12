"""Phase 5 Durable Orchestration, DAG Workflows, Jobs & Workers

Revision ID: 005_phase5_orchestration
Revises: 004_phase4_agents
Create Date: 2026-08-31 23:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '005_phase5_orchestration'
down_revision: Union[str, Sequence[str], None] = '004_phase4_agents'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    with op.batch_alter_table('tasks') as batch_op:
        batch_op.add_column(sa.Column('idempotency_key', sa.String(length=100), nullable=True))
        batch_op.add_column(sa.Column('agent_version_id', sa.String(length=36), nullable=True))
        batch_op.add_column(sa.Column('cancelled_at', sa.DateTime(timezone=True), nullable=True))
        batch_op.create_index('ix_tasks_idempotency_key', ['idempotency_key'], unique=True)
        batch_op.create_foreign_key('fk_tasks_agent_version_id', 'agent_versions', ['agent_version_id'], ['id'], ondelete='SET NULL')

    op.create_table(
        'workflows',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('task_id', sa.String(length=36), sa.ForeignKey('tasks.id', ondelete='CASCADE'), nullable=False),
        sa.Column('created_by', sa.String(length=36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('status', sa.String(length=50), nullable=False, default='CREATED'),
        sa.Column('idempotency_key', sa.String(length=100), nullable=True, unique=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False)
    )
    op.create_index('ix_workflows_status', 'workflows', ['status'], unique=False)
    op.create_index('ix_workflows_idempotency_key', 'workflows', ['idempotency_key'], unique=True)

    op.create_table(
        'workflow_nodes',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('workflow_id', sa.String(length=36), sa.ForeignKey('workflows.id', ondelete='CASCADE'), nullable=False),
        sa.Column('step_order', sa.Integer(), nullable=False),
        sa.Column('domain', sa.String(length=50), nullable=False),
        sa.Column('agent_id', sa.String(length=36), sa.ForeignKey('agents.id', ondelete='SET NULL'), nullable=True),
        sa.Column('agent_version_id', sa.String(length=36), sa.ForeignKey('agent_versions.id', ondelete='SET NULL'), nullable=True),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('input_prompt', sa.Text(), nullable=False),
        sa.Column('output_result', sa.Text(), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=False, default='PENDING'),
        sa.Column('attempt_count', sa.Integer(), nullable=False, default=0),
        sa.Column('max_attempts', sa.Integer(), nullable=False, default=3),
        sa.Column('lease_owner', sa.String(length=100), nullable=True),
        sa.Column('lease_expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('tokens_used', sa.Integer(), nullable=False, default=0),
        sa.Column('cost_usdc', sa.Numeric(precision=18, scale=6), nullable=False, default=0.0),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False)
    )
    op.create_index('ix_workflow_nodes_status', 'workflow_nodes', ['status'], unique=False)

    op.create_table(
        'workflow_edges',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('workflow_id', sa.String(length=36), sa.ForeignKey('workflows.id', ondelete='CASCADE'), nullable=False),
        sa.Column('parent_node_id', sa.String(length=36), sa.ForeignKey('workflow_nodes.id', ondelete='CASCADE'), nullable=False),
        sa.Column('child_node_id', sa.String(length=36), sa.ForeignKey('workflow_nodes.id', ondelete='CASCADE'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False)
    )

    op.create_table(
        'execution_jobs',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('workflow_id', sa.String(length=36), sa.ForeignKey('workflows.id', ondelete='CASCADE'), nullable=False),
        sa.Column('node_id', sa.String(length=36), sa.ForeignKey('workflow_nodes.id', ondelete='CASCADE'), nullable=False),
        sa.Column('status', sa.String(length=50), nullable=False, default='QUEUED'),
        sa.Column('queue_name', sa.String(length=50), nullable=False, default='default'),
        sa.Column('attempt_count', sa.Integer(), nullable=False, default=0),
        sa.Column('max_attempts', sa.Integer(), nullable=False, default=3),
        sa.Column('lease_owner', sa.String(length=100), nullable=True),
        sa.Column('lease_expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('last_error', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False)
    )
    op.create_index('ix_execution_jobs_status', 'execution_jobs', ['status'], unique=False)
    op.create_index('ix_execution_jobs_queue_name', 'execution_jobs', ['queue_name'], unique=False)

    op.create_table(
        'execution_workers',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('worker_name', sa.String(length=100), nullable=False, unique=True),
        sa.Column('status', sa.String(length=50), nullable=False, default='READY'),
        sa.Column('current_job_id', sa.String(length=36), nullable=True),
        sa.Column('last_heartbeat_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False)
    )
    op.create_index('ix_execution_workers_worker_name', 'execution_workers', ['worker_name'], unique=True)

def downgrade() -> None:
    op.drop_table('execution_workers')
    op.drop_table('execution_jobs')
    op.drop_table('workflow_edges')
    op.drop_table('workflow_nodes')
    op.drop_table('workflows')
    with op.batch_alter_table('tasks') as batch_op:
        batch_op.drop_constraint('fk_tasks_agent_version_id', type_='foreignkey')
        batch_op.drop_index('idx_tasks_idempotency_key')
        batch_op.drop_column('cancelled_at')
        batch_op.drop_column('agent_version_id')
        batch_op.drop_column('idempotency_key')
