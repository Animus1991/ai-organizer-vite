"""test template

Revision ID: dd5490fc2d58
Revises: 014e7f788805
Create Date: 2025-12-29 23:59:10.086338

"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel  # ✅ always available for SQLModel-generated types


# revision identifiers, used by Alembic.
revision: str = 'dd5490fc2d58'
down_revision: Union[str, Sequence[str], None] = '014e7f788805'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
