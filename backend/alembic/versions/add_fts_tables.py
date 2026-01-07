"""add FTS tables for full-text search

Revision ID: add_fts_tables
Revises: dd5490fc2d58
Create Date: 2025-01-XX XX:XX:XX.XXXXXX

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_fts_tables'
down_revision: Union[str, Sequence[str], None] = 'dd5490fc2d58'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create FTS virtual tables for documents and segments."""
    # Create FTS5 virtual table for documents
    op.execute("""
        CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts USING fts5(
            id UNINDEXED,
            title,
            text,
            content='documents',
            content_rowid='id'
        )
    """)
    
    # Create FTS5 virtual table for segments
    op.execute("""
        CREATE VIRTUAL TABLE IF NOT EXISTS segments_fts USING fts5(
            id UNINDEXED,
            document_id UNINDEXED,
            title,
            content,
            mode UNINDEXED,
            content='segments',
            content_rowid='id'
        )
    """)
    
    # Create triggers to keep FTS tables in sync
    # Document triggers
    op.execute("""
        CREATE TRIGGER IF NOT EXISTS documents_fts_insert AFTER INSERT ON documents BEGIN
            INSERT INTO documents_fts(rowid, id, title, text)
            VALUES (new.id, new.id, new.title, new.text);
        END
    """)
    
    op.execute("""
        CREATE TRIGGER IF NOT EXISTS documents_fts_delete AFTER DELETE ON documents BEGIN
            DELETE FROM documents_fts WHERE rowid = old.id;
        END
    """)
    
    op.execute("""
        CREATE TRIGGER IF NOT EXISTS documents_fts_update AFTER UPDATE ON documents BEGIN
            DELETE FROM documents_fts WHERE rowid = old.id;
            INSERT INTO documents_fts(rowid, id, title, text)
            VALUES (new.id, new.id, new.title, new.text);
        END
    """)
    
    # Segment triggers
    op.execute("""
        CREATE TRIGGER IF NOT EXISTS segments_fts_insert AFTER INSERT ON segments BEGIN
            INSERT INTO segments_fts(rowid, id, document_id, title, content, mode)
            VALUES (new.id, new.id, new.document_id, new.title, new.content, new.mode);
        END
    """)
    
    op.execute("""
        CREATE TRIGGER IF NOT EXISTS segments_fts_delete AFTER DELETE ON segments BEGIN
            DELETE FROM segments_fts WHERE rowid = old.id;
        END
    """)
    
    op.execute("""
        CREATE TRIGGER IF NOT EXISTS segments_fts_update AFTER UPDATE ON segments BEGIN
            DELETE FROM segments_fts WHERE rowid = old.id;
            INSERT INTO segments_fts(rowid, id, document_id, title, content, mode)
            VALUES (new.id, new.id, new.document_id, new.title, new.content, new.mode);
        END
    """)
    
    # Populate FTS tables with existing data
    op.execute("""
        INSERT INTO documents_fts(rowid, id, title, text)
        SELECT id, id, title, text FROM documents
    """)
    
    op.execute("""
        INSERT INTO segments_fts(rowid, id, document_id, title, content, mode)
        SELECT id, id, document_id, title, content, mode FROM segments
    """)


def downgrade() -> None:
    """Drop FTS tables and triggers."""
    op.execute("DROP TRIGGER IF EXISTS segments_fts_update")
    op.execute("DROP TRIGGER IF EXISTS segments_fts_delete")
    op.execute("DROP TRIGGER IF EXISTS segments_fts_insert")
    op.execute("DROP TRIGGER IF EXISTS documents_fts_update")
    op.execute("DROP TRIGGER IF EXISTS documents_fts_delete")
    op.execute("DROP TRIGGER IF EXISTS documents_fts_insert")
    op.execute("DROP TABLE IF EXISTS segments_fts")
    op.execute("DROP TABLE IF EXISTS documents_fts")

