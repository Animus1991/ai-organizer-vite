"""add parse_status to documents

Revision ID: a08064228388
Revises: 431e8b54d6d9
Create Date: 2025-12-29 20:51:05.220748

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a08064228388'
down_revision: Union[str, Sequence[str], None] = '431e8b54d6d9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():
    # SQLite-friendly ALTER μέσω batch
    with op.batch_alter_table("documents") as batch:
        batch.add_column(sa.Column("parse_status", sa.String(length=32), nullable=False, server_default="ok"))
        batch.add_column(sa.Column("parse_error", sa.Text(), nullable=True))

    op.create_index("ix_documents_parse_status", "documents", ["parse_status"], unique=False)

def downgrade():
    op.drop_index("ix_documents_parse_status", table_name="documents")
    with op.batch_alter_table("documents") as batch:
        batch.drop_column("parse_error")
        batch.drop_column("parse_status")