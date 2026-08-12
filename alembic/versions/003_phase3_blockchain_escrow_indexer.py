"""Phase 3 Blockchain, Escrow State Machine & Indexer Migration

Revision ID: 003_phase3_blockchain
Revises: 002_phase2_auth
Create Date: 2026-08-31 18:50:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '003_phase3_blockchain'
down_revision: Union[str, Sequence[str], None] = '002_phase2_auth'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    # 1. Create indexer_state table
    op.create_table(
        'indexer_state',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('chain_id', sa.Integer(), nullable=False),
        sa.Column('contract_address', sa.String(length=42), nullable=False),
        sa.Column('last_processed_block', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('chain_id', 'contract_address', name='uq_indexer_chain_contract')
    )

    # 2. Add columns to escrows table and drop obsolete release_tx_hash
    with op.batch_alter_table('escrows') as batch_op:
        batch_op.add_column(sa.Column('buyer_id', sa.String(length=36), nullable=True))
        batch_op.add_column(sa.Column('agent_owner_id', sa.String(length=36), nullable=True))
        batch_op.add_column(sa.Column('escrow_identifier', sa.String(length=66), nullable=True))
        batch_op.add_column(sa.Column('deposit_block_number', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('settlement_tx_hash', sa.String(length=66), nullable=True))
        batch_op.add_column(sa.Column('settlement_block_number', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('refund_tx_hash', sa.String(length=66), nullable=True))
        batch_op.add_column(sa.Column('refund_block_number', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('funded_at', sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column('refunded_at', sa.DateTime(timezone=True), nullable=True))
        batch_op.alter_column('deposit_tx_hash', existing_type=sa.String(length=66), nullable=True)
        batch_op.drop_column('release_tx_hash')

        batch_op.create_index('ix_escrows_escrow_identifier', ['escrow_identifier'], unique=True)
        batch_op.create_index('ix_escrows_settlement_tx_hash', ['settlement_tx_hash'], unique=True)
        batch_op.create_index('ix_escrows_refund_tx_hash', ['refund_tx_hash'], unique=True)
        batch_op.create_foreign_key('fk_escrows_buyer_id', 'users', ['buyer_id'], ['id'], ondelete='SET NULL')
        batch_op.create_foreign_key('fk_escrows_agent_owner_id', 'users', ['agent_owner_id'], ['id'], ondelete='SET NULL')

def downgrade() -> None:
    with op.batch_alter_table('escrows') as batch_op:
        batch_op.drop_constraint('fk_escrows_agent_owner_id', type_='foreignkey')
        batch_op.drop_constraint('fk_escrows_buyer_id', type_='foreignkey')
        batch_op.drop_index('idx_escrows_refund_tx_hash')
        batch_op.drop_index('idx_escrows_settlement_tx_hash')
        batch_op.drop_index('idx_escrows_escrow_identifier')
        batch_op.drop_column('refunded_at')
        batch_op.drop_column('funded_at')
        batch_op.drop_column('refund_block_number')
        batch_op.drop_column('refund_tx_hash')
        batch_op.drop_column('settlement_block_number')
        batch_op.drop_column('settlement_tx_hash')
        batch_op.drop_column('deposit_block_number')
        batch_op.drop_column('escrow_identifier')
        batch_op.drop_column('agent_owner_id')
        batch_op.drop_column('buyer_id')

    op.drop_table('indexer_state')
