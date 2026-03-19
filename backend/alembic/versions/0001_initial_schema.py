"""initial schema

Revision ID: 0001
Revises:
Create Date: 2024-01-01 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '0001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── users ─────────────────────────────────────────────────────────────────
    op.create_table(
        'users',
        sa.Column('id',              sa.Integer(),     nullable=False),
        sa.Column('username',        sa.String(64),    nullable=False),
        sa.Column('email',           sa.String(255),   nullable=False),
        sa.Column('hashed_password', sa.String(128),   nullable=False),
        sa.Column('is_admin',        sa.Boolean(),     nullable=False, server_default='false'),
        sa.Column('is_active',       sa.Boolean(),     nullable=False, server_default='true'),
        sa.Column('created_at',      sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_users_id',       'users', ['id'],       unique=False)
    op.create_index('ix_users_username', 'users', ['username'], unique=True)
    op.create_index('ix_users_email',    'users', ['email'],    unique=True)

    # ── scenarios ─────────────────────────────────────────────────────────────
    op.create_table(
        'scenarios',
        sa.Column('id',                 sa.Integer(),     nullable=False),
        sa.Column('name',               sa.String(200),   nullable=False),
        sa.Column('description',        sa.Text(),        nullable=False, server_default=''),
        sa.Column('initial_prompt',     sa.Text(),        nullable=False),
        sa.Column('difficulty_level',   sa.String(16),    nullable=False, server_default='medium'),
        sa.Column('max_attempts',       sa.Integer(),     nullable=False, server_default='3'),
        sa.Column('scenario_structure', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='{}'),
        sa.Column('created_by',         sa.Integer(),     nullable=True),
        sa.Column('created_at',         sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at',         sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['created_by'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_scenarios_id',   'scenarios', ['id'],   unique=False)
    op.create_index('ix_scenarios_name', 'scenarios', ['name'], unique=True)

    # ── game_sessions ─────────────────────────────────────────────────────────
    op.create_table(
        'game_sessions',
        sa.Column('id',                 sa.Integer(),     nullable=False),
        sa.Column('session_id',         sa.String(36),    nullable=False),
        sa.Column('scenario_id',        sa.Integer(),     nullable=False),
        sa.Column('team_name',          sa.String(100),   nullable=True),
        sa.Column('current_state',      postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='{}'),
        sa.Column('attempts_remaining', sa.Integer(),     nullable=False, server_default='3'),
        sa.Column('is_active',          sa.Boolean(),     nullable=False, server_default='true'),
        sa.Column('participants',       postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='[]'),
        sa.Column('saved_at',           sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at',         sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at',         sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['scenario_id'], ['scenarios.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_game_sessions_id',         'game_sessions', ['id'],         unique=False)
    op.create_index('ix_game_sessions_session_id', 'game_sessions', ['session_id'], unique=True)


def downgrade() -> None:
    op.drop_index('ix_game_sessions_session_id', table_name='game_sessions')
    op.drop_index('ix_game_sessions_id',         table_name='game_sessions')
    op.drop_table('game_sessions')

    op.drop_index('ix_scenarios_name', table_name='scenarios')
    op.drop_index('ix_scenarios_id',   table_name='scenarios')
    op.drop_table('scenarios')

    op.drop_index('ix_users_email',    table_name='users')
    op.drop_index('ix_users_username', table_name='users')
    op.drop_index('ix_users_id',       table_name='users')
    op.drop_table('users')
