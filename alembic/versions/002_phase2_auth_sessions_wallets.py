"""Phase 2 Auth, Sessions, Wallets and RBAC Indexes

Revision ID: 002_phase2_auth
Revises: 60605f100000
Create Date: 2026-08-31 16:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '002_phase2_auth'
down_revision: Union[str, Sequence[str], None] = '60605f100000'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    # Additional composite indexes for Phase 2 query optimization
    op.create_index('idx_sessions_user_revoked', 'sessions', ['user_id', 'is_revoked'], unique=False)
    op.create_index('idx_audit_logs_actor_action', 'audit_logs', ['actor_id', 'action'], unique=False)

def downgrade() -> None:
    op.drop_index('idx_audit_logs_actor_action', table_name='audit_logs')
    op.drop_index('idx_sessions_user_revoked', table_name='sessions')
