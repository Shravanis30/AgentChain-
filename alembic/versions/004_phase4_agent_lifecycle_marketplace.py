"""Phase 4 Agent Lifecycle, Marketplace Performance Indexes & Timestamps

Revision ID: 004_phase4_agents
Revises: 003_phase3_blockchain
Create Date: 2026-08-31 22:50:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '004_phase4_agents'
down_revision: Union[str, Sequence[str], None] = '003_phase3_blockchain'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    with op.batch_alter_table('agents') as batch_op:
        batch_op.add_column(sa.Column('current_version_id', sa.String(length=36), nullable=True))
        batch_op.add_column(sa.Column('published_at', sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column('suspended_at', sa.DateTime(timezone=True), nullable=True))

        batch_op.create_index('idx_agents_category_status', ['category', 'status'], unique=False)
        batch_op.create_index('idx_agents_owner_status', ['owner_id', 'status'], unique=False)

def downgrade() -> None:
    with op.batch_alter_table('agents') as batch_op:
        batch_op.drop_index('idx_agents_owner_status')
        batch_op.drop_index('idx_agents_category_status')
        batch_op.drop_column('suspended_at')
        batch_op.drop_column('published_at')
        batch_column.drop_column('current_version_id')
