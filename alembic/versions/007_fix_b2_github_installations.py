"""Fix B2 Multi-Tenant GitHub Installations Migration

Revision ID: 007_fix_b2_github
Revises: 006_fix_b_columns
Create Date: 2026-09-02 13:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '007_fix_b2_github'
down_revision: Union[str, Sequence[str], None] = '006_fix_b_columns'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    with op.batch_alter_table('github_installations') as batch_op:
        batch_op.add_column(sa.Column('account_login', sa.String(length=100), server_default='', nullable=False))
        batch_op.add_column(sa.Column('account_type', sa.String(length=20), server_default='User', nullable=False))
        batch_op.alter_column('github_username', existing_type=sa.String(length=100), nullable=True)
        batch_op.alter_column('access_token', existing_type=sa.Text(), nullable=True)

    with op.batch_alter_table('build_jobs') as batch_op:
        batch_op.add_column(sa.Column('installation_id', sa.String(length=100), nullable=True))

def downgrade() -> None:
    with op.batch_alter_table('build_jobs') as batch_op:
        batch_op.drop_column('installation_id')

    with op.batch_alter_table('github_installations') as batch_op:
        batch_op.drop_column('account_type')
        batch_op.drop_column('account_login')
