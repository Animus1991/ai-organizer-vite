"""add document_versions table for provenance-safe editing

Revision ID: 20250109_add_document_versions
Revises: 20250108180000
Create Date: 2025-01-09 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel

# revision identifiers, used by Alembic.
revision: str = '20250109_add_document_versions'
down_revision: Union[str, None] = '20250108180000'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create document_versions table for provenance-safe document editing."""
    # Create document_versions table
    op.create_table(
        'document_versions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('document_id', sa.Integer(), nullable=False),
        sa.Column('version_number', sa.Integer(), nullable=False),
        sa.Column('title', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('text', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('created_by_user_id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['document_id'], ['documents.id'], ),
        sa.ForeignKeyConstraint(['created_by_user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('document_id', 'version_number', name='uq_document_version')
    )
    
    with op.batch_alter_table('document_versions', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_document_versions_document_id'), ['document_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_document_versions_version_number'), ['version_number'], unique=False)
        batch_op.create_index(batch_op.f('ix_document_versions_created_by_user_id'), ['created_by_user_id'], unique=False)


def downgrade() -> None:
    """Drop document_versions table."""
    with op.batch_alter_table('document_versions', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_document_versions_created_by_user_id'))
        batch_op.drop_index(batch_op.f('ix_document_versions_version_number'))
        batch_op.drop_index(batch_op.f('ix_document_versions_document_id'))
    op.drop_table('document_versions')
