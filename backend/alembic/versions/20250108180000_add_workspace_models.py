"""add workspace models (folders, notes)

Revision ID: 20250108180000
Revises: add_fts_tables
Create Date: 2025-01-08 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel

# revision identifiers, used by Alembic.
revision: str = '20250108180000'
down_revision: Union[str, None] = 'add_fts_tables'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create folders table
    op.create_table(
        'folders',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('document_id', sa.Integer(), nullable=False),
        sa.Column('name', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['document_id'], ['documents.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('folders', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_folders_user_id'), ['user_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_folders_document_id'), ['document_id'], unique=False)

    # Create folder_items table
    op.create_table(
        'folder_items',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('folder_id', sa.Integer(), nullable=False),
        sa.Column('segment_id', sa.Integer(), nullable=True),
        sa.Column('chunk_id', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('chunk_title', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('chunk_content', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('chunk_mode', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('chunk_is_manual', sa.Boolean(), nullable=True),
        sa.Column('chunk_order_index', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['folder_id'], ['folders.id'], ),
        sa.ForeignKeyConstraint(['segment_id'], ['segments.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('folder_items', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_folder_items_folder_id'), ['folder_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_folder_items_segment_id'), ['segment_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_folder_items_chunk_id'), ['chunk_id'], unique=False)

    # Create smart_notes table
    op.create_table(
        'smart_notes',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('document_id', sa.Integer(), nullable=False),
        sa.Column('content', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('html', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('tags', sqlmodel.sql.sqltypes.AutoString(), nullable=False, server_default='[]'),
        sa.Column('category', sqlmodel.sql.sqltypes.AutoString(), nullable=False, server_default='General'),
        sa.Column('priority', sqlmodel.sql.sqltypes.AutoString(), nullable=False, server_default='medium'),
        sa.Column('chunk_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['document_id'], ['documents.id'], ),
        sa.ForeignKeyConstraint(['chunk_id'], ['segments.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('smart_notes', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_smart_notes_user_id'), ['user_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_smart_notes_document_id'), ['document_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_smart_notes_chunk_id'), ['chunk_id'], unique=False)

    # Create document_notes table
    op.create_table(
        'document_notes',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('document_id', sa.Integer(), nullable=False),
        sa.Column('html', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('text', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['document_id'], ['documents.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('document_id')
    )
    with op.batch_alter_table('document_notes', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_document_notes_user_id'), ['user_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_document_notes_document_id'), ['document_id'], unique=True)


def downgrade() -> None:
    with op.batch_alter_table('document_notes', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_document_notes_document_id'))
        batch_op.drop_index(batch_op.f('ix_document_notes_user_id'))
    op.drop_table('document_notes')
    
    with op.batch_alter_table('smart_notes', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_smart_notes_chunk_id'))
        batch_op.drop_index(batch_op.f('ix_smart_notes_document_id'))
        batch_op.drop_index(batch_op.f('ix_smart_notes_user_id'))
    op.drop_table('smart_notes')
    
    with op.batch_alter_table('folder_items', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_folder_items_chunk_id'))
        batch_op.drop_index(batch_op.f('ix_folder_items_segment_id'))
        batch_op.drop_index(batch_op.f('ix_folder_items_folder_id'))
    op.drop_table('folder_items')
    
    with op.batch_alter_table('folders', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_folders_document_id'))
        batch_op.drop_index(batch_op.f('ix_folders_user_id'))
    op.drop_table('folders')
