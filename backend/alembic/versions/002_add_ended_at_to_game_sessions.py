"""add ended_at to game_sessions

Revision ID: 0002
Revises: 001
Create Date: 2026-03-24
"""
from alembic import op
import sqlalchemy as sa

revision = '0002'
down_revision = '0001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        ALTER TABLE game_sessions
        ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ
    """)


def downgrade() -> None:
    op.drop_column('game_sessions', 'ended_at')