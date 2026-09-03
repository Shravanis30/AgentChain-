"""Fix B Agent Versions Columns Migration

Revision ID: 006_fix_b_columns
Revises: 005_phase5_orchestration
Create Date: 2026-09-02 12:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '006_fix_b_columns'
down_revision: Union[str, Sequence[str], None] = '005_phase5_orchestration'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    with op.batch_alter_table('agent_versions') as batch_op:
        batch_op.add_column(sa.Column('source_type', sa.String(length=20), server_default='PROMPT_ONLY', nullable=False))
        batch_op.add_column(sa.Column('source_repo', sa.String(length=255), nullable=True))
        batch_op.add_column(sa.Column('source_ref', sa.String(length=100), nullable=True))
        batch_op.add_column(sa.Column('onchain_tx_hash', sa.String(length=66), nullable=True))
        batch_op.add_column(sa.Column('onchain_block_number', sa.Integer(), nullable=True))

def downgrade() -> None:
    with op.batch_alter_table('agent_versions') as batch_op:
        batch_op.drop_column('onchain_block_number')
        batch_op.drop_column('onchain_tx_hash')
        batch_op.drop_column('source_ref')
        batch_op.drop_column('source_repo')
        batch_op.drop_column('source_type')
