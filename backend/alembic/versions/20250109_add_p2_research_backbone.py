"""add P2 research backbone: segment typing, evidence grading, linking graph

Revision ID: 20250109_p2_research_backbone
Revises: 20250109_add_document_versions
Create Date: 2025-01-09 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel

# revision identifiers, used by Alembic.
revision: str = '20250109_p2_research_backbone'
down_revision: Union[str, None] = '20250109_add_document_versions'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add P2 research-grade fields to segments and create segment_links table."""
    
    # 1. Add research-grade fields to segments table
    with op.batch_alter_table('segments', schema=None) as batch_op:
        # segment_type: Optional[str] with default 'untyped'
        batch_op.add_column(sa.Column('segment_type', sqlmodel.sql.sqltypes.AutoString(), nullable=True, server_default='untyped'))
        batch_op.create_index(batch_op.f('ix_segments_segment_type'), ['segment_type'], unique=False)
        
        # evidence_grade: Optional[str] (E0-E4)
        batch_op.add_column(sa.Column('evidence_grade', sqlmodel.sql.sqltypes.AutoString(), nullable=True))
        batch_op.create_index(batch_op.f('ix_segments_evidence_grade'), ['evidence_grade'], unique=False)
        
        # falsifiability_criteria: Optional[str] (text field)
        batch_op.add_column(sa.Column('falsifiability_criteria', sqlmodel.sql.sqltypes.AutoString(), nullable=True))
    
    # 2. Create segment_links table for linking graph
    op.create_table(
        'segment_links',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('from_segment_id', sa.Integer(), nullable=False),
        sa.Column('to_segment_id', sa.Integer(), nullable=False),
        sa.Column('link_type', sqlmodel.sql.sqltypes.AutoString(), nullable=False, server_default='related'),
        sa.Column('notes', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('created_by_user_id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['from_segment_id'], ['segments.id'], ),
        sa.ForeignKeyConstraint(['to_segment_id'], ['segments.id'], ),
        sa.ForeignKeyConstraint(['created_by_user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('from_segment_id', 'to_segment_id', 'link_type', name='uq_segment_link'),
        sa.CheckConstraint('from_segment_id != to_segment_id', name='ck_no_self_link')
    )
    
    with op.batch_alter_table('segment_links', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_segment_links_from_segment_id'), ['from_segment_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_segment_links_to_segment_id'), ['to_segment_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_segment_links_link_type'), ['link_type'], unique=False)
        batch_op.create_index(batch_op.f('ix_segment_links_created_by_user_id'), ['created_by_user_id'], unique=False)


def downgrade() -> None:
    """Remove P2 research-grade fields and segment_links table."""
    
    # Drop segment_links table
    with op.batch_alter_table('segment_links', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_segment_links_created_by_user_id'))
        batch_op.drop_index(batch_op.f('ix_segment_links_link_type'))
        batch_op.drop_index(batch_op.f('ix_segment_links_to_segment_id'))
        batch_op.drop_index(batch_op.f('ix_segment_links_from_segment_id'))
    op.drop_table('segment_links')
    
    # Remove research-grade fields from segments table
    with op.batch_alter_table('segments', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_segments_evidence_grade'))
        batch_op.drop_index(batch_op.f('ix_segments_segment_type'))
        batch_op.drop_column('falsifiability_criteria')
        batch_op.drop_column('evidence_grade')
        batch_op.drop_column('segment_type')
