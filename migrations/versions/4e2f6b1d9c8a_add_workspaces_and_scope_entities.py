"""add workspaces and scope entities by workspace_id

Revision ID: 4e2f6b1d9c8a
Revises: b8f2a1d0c3e4
Create Date: 2026-02-18 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "4e2f6b1d9c8a"
down_revision: Union[str, None] = "b8f2a1d0c3e4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


workspace_kind_enum = postgresql.ENUM(
    "PERSONAL",
    "SHARED",
    name="workspacekind",
)
workspace_role_enum = postgresql.ENUM(
    "OWNER",
    "EDITOR",
    name="workspacerole",
)
workspace_kind_enum_ref = postgresql.ENUM(
    "PERSONAL",
    "SHARED",
    name="workspacekind",
    create_type=False,
)
workspace_role_enum_ref = postgresql.ENUM(
    "OWNER",
    "EDITOR",
    name="workspacerole",
    create_type=False,
)


def upgrade() -> None:
    workspace_kind_enum.create(op.get_bind(), checkfirst=True)
    workspace_role_enum.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "workspaces",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("kind", workspace_kind_enum_ref, nullable=False),
        sa.Column("owner_user_id", sa.Integer(), nullable=False),
        sa.Column("personal_for_user_id", sa.Integer(), nullable=True),
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
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["owner_user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["personal_for_user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("personal_for_user_id"),
    )
    op.create_index("ix_workspaces_deleted_at", "workspaces", ["deleted_at"])
    op.create_index("ix_workspaces_kind", "workspaces", ["kind"])
    op.create_index("ix_workspaces_owner_user_id", "workspaces", ["owner_user_id"])
    op.create_index(
        "ix_workspaces_personal_for_user_id",
        "workspaces",
        ["personal_for_user_id"],
    )

    op.create_table(
        "workspace_memberships",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("workspace_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("role", workspace_role_enum_ref, nullable=False),
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
        sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "workspace_id", "user_id", name="uq_workspace_memberships_pair"
        ),
    )
    op.create_index(
        "ix_workspace_memberships_workspace_id",
        "workspace_memberships",
        ["workspace_id"],
    )
    op.create_index(
        "ix_workspace_memberships_user_id", "workspace_memberships", ["user_id"]
    )

    op.add_column("accounts", sa.Column("workspace_id", sa.Integer(), nullable=True))
    op.add_column("categories", sa.Column("workspace_id", sa.Integer(), nullable=True))
    op.add_column(
        "transactions", sa.Column("workspace_id", sa.Integer(), nullable=True)
    )
    op.add_column(
        "recurring_transactions",
        sa.Column("workspace_id", sa.Integer(), nullable=True),
    )
    op.add_column(
        "shopping_lists", sa.Column("workspace_id", sa.Integer(), nullable=True)
    )
    op.add_column(
        "shopping_templates", sa.Column("workspace_id", sa.Integer(), nullable=True)
    )

    op.execute(
        """
        INSERT INTO workspaces (name, kind, owner_user_id, personal_for_user_id, created_at, updated_at)
        SELECT 'Личное пространство', 'PERSONAL', u.id, u.id, now(), now()
        FROM users u
        WHERE NOT EXISTS (
            SELECT 1 FROM workspaces w WHERE w.personal_for_user_id = u.id
        )
        """
    )

    op.execute(
        """
        INSERT INTO workspace_memberships (workspace_id, user_id, role, created_at, updated_at)
        SELECT w.id, w.personal_for_user_id, 'OWNER', now(), now()
        FROM workspaces w
        WHERE w.personal_for_user_id IS NOT NULL
          AND NOT EXISTS (
              SELECT 1
              FROM workspace_memberships m
              WHERE m.workspace_id = w.id AND m.user_id = w.personal_for_user_id
          )
        """
    )

    op.execute(
        """
        UPDATE accounts a
        SET workspace_id = w.id
        FROM workspaces w
        WHERE w.personal_for_user_id = a.user_id AND a.workspace_id IS NULL
        """
    )
    op.execute(
        """
        UPDATE categories c
        SET workspace_id = w.id
        FROM workspaces w
        WHERE w.personal_for_user_id = c.user_id AND c.workspace_id IS NULL
        """
    )
    op.execute(
        """
        UPDATE transactions t
        SET workspace_id = w.id
        FROM workspaces w
        WHERE w.personal_for_user_id = t.user_id AND t.workspace_id IS NULL
        """
    )
    op.execute(
        """
        UPDATE recurring_transactions r
        SET workspace_id = w.id
        FROM workspaces w
        WHERE w.personal_for_user_id = r.user_id AND r.workspace_id IS NULL
        """
    )
    op.execute(
        """
        UPDATE shopping_lists s
        SET workspace_id = w.id
        FROM workspaces w
        WHERE w.personal_for_user_id = s.user_id AND s.workspace_id IS NULL
        """
    )
    op.execute(
        """
        UPDATE shopping_templates s
        SET workspace_id = w.id
        FROM workspaces w
        WHERE w.personal_for_user_id = s.user_id AND s.workspace_id IS NULL
        """
    )

    op.alter_column("accounts", "workspace_id", nullable=False)
    op.alter_column("categories", "workspace_id", nullable=False)
    op.alter_column("transactions", "workspace_id", nullable=False)
    op.alter_column("recurring_transactions", "workspace_id", nullable=False)
    op.alter_column("shopping_lists", "workspace_id", nullable=False)
    op.alter_column("shopping_templates", "workspace_id", nullable=False)

    op.create_foreign_key(
        "fk_accounts_workspace_id",
        "accounts",
        "workspaces",
        ["workspace_id"],
        ["id"],
    )
    op.create_foreign_key(
        "fk_categories_workspace_id",
        "categories",
        "workspaces",
        ["workspace_id"],
        ["id"],
    )
    op.create_foreign_key(
        "fk_transactions_workspace_id",
        "transactions",
        "workspaces",
        ["workspace_id"],
        ["id"],
    )
    op.create_foreign_key(
        "fk_recurring_transactions_workspace_id",
        "recurring_transactions",
        "workspaces",
        ["workspace_id"],
        ["id"],
    )
    op.create_foreign_key(
        "fk_shopping_lists_workspace_id",
        "shopping_lists",
        "workspaces",
        ["workspace_id"],
        ["id"],
    )
    op.create_foreign_key(
        "fk_shopping_templates_workspace_id",
        "shopping_templates",
        "workspaces",
        ["workspace_id"],
        ["id"],
    )

    op.create_index("ix_accounts_workspace_id", "accounts", ["workspace_id"])
    op.create_index("ix_categories_workspace_id", "categories", ["workspace_id"])
    op.create_index("ix_transactions_workspace_id", "transactions", ["workspace_id"])
    op.create_index(
        "ix_recurring_transactions_workspace_id",
        "recurring_transactions",
        ["workspace_id"],
    )
    op.create_index(
        "ix_shopping_lists_workspace_id", "shopping_lists", ["workspace_id"]
    )
    op.create_index(
        "ix_shopping_templates_workspace_id",
        "shopping_templates",
        ["workspace_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_shopping_templates_workspace_id", table_name="shopping_templates")
    op.drop_index("ix_shopping_lists_workspace_id", table_name="shopping_lists")
    op.drop_index(
        "ix_recurring_transactions_workspace_id", table_name="recurring_transactions"
    )
    op.drop_index("ix_transactions_workspace_id", table_name="transactions")
    op.drop_index("ix_categories_workspace_id", table_name="categories")
    op.drop_index("ix_accounts_workspace_id", table_name="accounts")

    op.drop_constraint(
        "fk_shopping_templates_workspace_id", "shopping_templates", type_="foreignkey"
    )
    op.drop_constraint(
        "fk_shopping_lists_workspace_id", "shopping_lists", type_="foreignkey"
    )
    op.drop_constraint(
        "fk_recurring_transactions_workspace_id",
        "recurring_transactions",
        type_="foreignkey",
    )
    op.drop_constraint(
        "fk_transactions_workspace_id", "transactions", type_="foreignkey"
    )
    op.drop_constraint("fk_categories_workspace_id", "categories", type_="foreignkey")
    op.drop_constraint("fk_accounts_workspace_id", "accounts", type_="foreignkey")

    op.drop_column("shopping_templates", "workspace_id")
    op.drop_column("shopping_lists", "workspace_id")
    op.drop_column("recurring_transactions", "workspace_id")
    op.drop_column("transactions", "workspace_id")
    op.drop_column("categories", "workspace_id")
    op.drop_column("accounts", "workspace_id")

    op.drop_index(
        "ix_workspace_memberships_user_id", table_name="workspace_memberships"
    )
    op.drop_index(
        "ix_workspace_memberships_workspace_id", table_name="workspace_memberships"
    )
    op.drop_table("workspace_memberships")

    op.drop_index("ix_workspaces_personal_for_user_id", table_name="workspaces")
    op.drop_index("ix_workspaces_owner_user_id", table_name="workspaces")
    op.drop_index("ix_workspaces_kind", table_name="workspaces")
    op.drop_index("ix_workspaces_deleted_at", table_name="workspaces")
    op.drop_table("workspaces")

    workspace_role_enum.drop(op.get_bind(), checkfirst=True)
    workspace_kind_enum.drop(op.get_bind(), checkfirst=True)
