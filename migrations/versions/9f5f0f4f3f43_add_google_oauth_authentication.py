"""add google oauth authentication

Revision ID: 9f5f0f4f3f43
Revises: cc2ac3db8ab7
Create Date: 2026-02-06 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "9f5f0f4f3f43"
down_revision: Union[str, None] = "cc2ac3db8ab7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "auth_provider",
            sa.String(length=50),
            nullable=False,
            server_default="google",
        ),
    )
    op.add_column(
        "users", sa.Column("google_sub", sa.String(length=255), nullable=True)
    )
    op.add_column(
        "users", sa.Column("avatar_url", sa.String(length=512), nullable=True)
    )
    op.alter_column(
        "users", "hashed_password", existing_type=sa.String(length=255), nullable=True
    )
    op.create_index(op.f("ix_users_google_sub"), "users", ["google_sub"], unique=True)

    op.create_table(
        "auth_exchange_codes",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("code_hash", sa.String(length=64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_auth_exchange_codes_code_hash"),
        "auth_exchange_codes",
        ["code_hash"],
        unique=True,
    )
    op.create_index(
        op.f("ix_auth_exchange_codes_user_id"),
        "auth_exchange_codes",
        ["user_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_auth_exchange_codes_user_id"), table_name="auth_exchange_codes"
    )
    op.drop_index(
        op.f("ix_auth_exchange_codes_code_hash"), table_name="auth_exchange_codes"
    )
    op.drop_table("auth_exchange_codes")

    op.drop_index(op.f("ix_users_google_sub"), table_name="users")
    op.alter_column(
        "users", "hashed_password", existing_type=sa.String(length=255), nullable=False
    )
    op.drop_column("users", "avatar_url")
    op.drop_column("users", "google_sub")
    op.drop_column("users", "auth_provider")
