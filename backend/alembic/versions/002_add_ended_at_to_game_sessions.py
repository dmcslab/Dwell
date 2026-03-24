"""add ended_at to game_sessions

Revision ID: 002
Revises: 001
Create Date: 2026-03-24
"""
from alembic import op
import sqlalchemy as sa

revision = '002'
down_revision = '001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'game_sessions',
        sa.Column('ended_at', sa.DateTime(), nullable=True)
    )


def downgrade() -> None:
    op.drop_column('game_sessions', 'ended_at')