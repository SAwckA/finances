"""add recurring transaction link to transactions

Revision ID: b8f2a1d0c3e4
Revises: 3c5e4d5b8f1a
Create Date: 2026-02-06 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "b8f2a1d0c3e4"
down_revision: Union[str, None] = "3c5e4d5b8f1a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "transactions",
        sa.Column("recurring_transaction_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_transactions_recurring_transaction_id",
        "transactions",
        "recurring_transactions",
        ["recurring_transaction_id"],
        ["id"],
    )
    op.create_index(
        op.f("ix_transactions_recurring_transaction_id"),
        "transactions",
        ["recurring_transaction_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_transactions_recurring_transaction_id"),
        table_name="transactions",
    )
    op.drop_constraint(
        "fk_transactions_recurring_transaction_id",
        "transactions",
        type_="foreignkey",
    )
    op.drop_column("transactions", "recurring_transaction_id")
