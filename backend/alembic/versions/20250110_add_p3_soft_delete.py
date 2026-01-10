"""add P3 soft delete fields: deleted_at for documents, segments, folders

Revision ID: 20250110_p3_soft_delete
Revises: 20250109_p2_research_backbone
Create Date: 2025-01-10 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel

# revision identifiers, used by Alembic.
revision: str = '20250110_p3_soft_delete'
down_revision: Union[str, None] = '20250109_p2_research_backbone'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add P3 soft delete fields to documents, segments, and folders tables."""
    
    # 1. Add deleted_at to documents table
    with op.batch_alter_table('documents', schema=None) as batch_op:
        batch_op.add_column(sa.Column('deleted_at', sa.DateTime(), nullable=True))
        batch_op.create_index(batch_op.f('ix_documents_deleted_at'), ['deleted_at'], unique=False)
    
    # 2. Add deleted_at to segments table
    with op.batch_alter_table('segments', schema=None) as batch_op:
        batch_op.add_column(sa.Column('deleted_at', sa.DateTime(), nullable=True))
        batch_op.create_index(batch_op.f('ix_segments_deleted_at'), ['deleted_at'], unique=False)
    
    # 3. Add deleted_at to folders table
    with op.batch_alter_table('folders', schema=None) as batch_op:
        batch_op.add_column(sa.Column('deleted_at', sa.DateTime(), nullable=True))
        batch_op.create_index(batch_op.f('ix_folders_deleted_at'), ['deleted_at'], unique=False)


def downgrade() -> None:
    """Remove P3 soft delete fields from documents, segments, and folders tables."""
    
    # Remove deleted_at from folders table
    with op.batch_alter_table('folders', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_folders_deleted_at'))
        batch_op.drop_column('deleted_at')
    
    # Remove deleted_at from segments table
    with op.batch_alter_table('segments', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_segments_deleted_at'))
        batch_op.drop_column('deleted_at')
    
    # Remove deleted_at from documents table
    with op.batch_alter_table('documents', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_documents_deleted_at'))
        batch_op.drop_column('deleted_at')
