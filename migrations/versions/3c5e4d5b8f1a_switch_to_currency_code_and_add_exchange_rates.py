"""switch to currency_code and add exchange rates history

Revision ID: 3c5e4d5b8f1a
Revises: 9f5f0f4f3f43
Create Date: 2026-02-07 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "3c5e4d5b8f1a"
down_revision: Union[str, None] = "9f5f0f4f3f43"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


exchange_rate_source = postgresql.ENUM("ECB", "CBR", name="exchangeratesource")
exchange_rate_run_status = postgresql.ENUM(
    "RUNNING",
    "COMPLETED",
    "COMPLETED_WITH_ERRORS",
    "FAILED",
    name="exchangeraterunstatus",
)
exchange_rate_source_ref = postgresql.ENUM(
    "ECB",
    "CBR",
    name="exchangeratesource",
    create_type=False,
)
exchange_rate_run_status_ref = postgresql.ENUM(
    "RUNNING",
    "COMPLETED",
    "COMPLETED_WITH_ERRORS",
    "FAILED",
    name="exchangeraterunstatus",
    create_type=False,
)


def upgrade() -> None:
    # Очистка зависимых данных (разрешено требованиями).
    op.execute("DELETE FROM transactions")
    op.execute("DELETE FROM recurring_transactions")
    op.execute("DELETE FROM shopping_items")
    op.execute("DELETE FROM shopping_lists")
    op.execute("DELETE FROM shopping_template_items")
    op.execute("DELETE FROM shopping_templates")
    op.execute("DELETE FROM accounts")

    # Переход accounts: currency_id -> currency_code.
    op.execute(
        "ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_currency_id_fkey"
    )
    op.drop_column("accounts", "currency_id")
    op.add_column(
        "accounts",
        sa.Column("currency_code", sa.String(length=10), nullable=False),
    )

    # currencies: code становится PK, id удаляется.
    op.execute("ALTER TABLE currencies DROP CONSTRAINT IF EXISTS currencies_pkey")
    op.execute("DROP INDEX IF EXISTS ix_currencies_code")
    op.execute("DELETE FROM currencies")
    op.drop_column("currencies", "id")
    op.create_primary_key("pk_currencies", "currencies", ["code"])

    currencies_table = sa.table(
        "currencies",
        sa.column("code", sa.String),
        sa.column("name", sa.String),
        sa.column("symbol", sa.String),
    )
    op.bulk_insert(
        currencies_table,
        [
            {"code": "USD", "name": "Доллар США", "symbol": "$"},
            {"code": "RUB", "name": "Российский рубль", "symbol": "₽"},
            {"code": "KZT", "name": "Казахстанский тенге", "symbol": "₸"},
        ],
    )
    op.execute(
        "ALTER TABLE accounts ADD CONSTRAINT accounts_currency_code_fkey FOREIGN KEY (currency_code) REFERENCES currencies (code)"
    )

    exchange_rate_source.create(op.get_bind(), checkfirst=True)
    exchange_rate_run_status.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "exchange_rate_runs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", exchange_rate_run_status_ref, nullable=False),
        sa.Column("base_date", sa.Date(), nullable=False),
        sa.Column("timezone", sa.String(length=50), nullable=False),
        sa.Column("pairs_total", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("pairs_saved", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("pairs_skipped", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("error_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("error_summary", sa.Text(), nullable=True),
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
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "exchange_rates",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("run_id", sa.Integer(), nullable=False),
        sa.Column("from_currency_code", sa.String(length=10), nullable=False),
        sa.Column("to_currency_code", sa.String(length=10), nullable=False),
        sa.Column("source", exchange_rate_source_ref, nullable=False),
        sa.Column("rate", sa.Numeric(precision=24, scale=12), nullable=False),
        sa.Column("effective_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "is_backfill", sa.Boolean(), nullable=False, server_default=sa.false()
        ),
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
        sa.CheckConstraint(
            "from_currency_code <> to_currency_code",
            name="ck_exchange_rates_pair_distinct",
        ),
        sa.ForeignKeyConstraint(["run_id"], ["exchange_rate_runs.id"]),
        sa.ForeignKeyConstraint(["from_currency_code"], ["currencies.code"]),
        sa.ForeignKeyConstraint(["to_currency_code"], ["currencies.code"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "run_id",
            "from_currency_code",
            "to_currency_code",
            "source",
            name="uq_exchange_rates_run_pair_source",
        ),
    )
    op.create_index(
        "ix_exchange_rates_pair_effective_at",
        "exchange_rates",
        ["from_currency_code", "to_currency_code", "effective_at"],
        unique=False,
    )
    op.create_index(
        "ix_exchange_rates_effective_at",
        "exchange_rates",
        ["effective_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_exchange_rates_effective_at", table_name="exchange_rates")
    op.drop_index("ix_exchange_rates_pair_effective_at", table_name="exchange_rates")
    op.drop_table("exchange_rates")
    op.drop_table("exchange_rate_runs")
    exchange_rate_source.drop(op.get_bind(), checkfirst=True)
    exchange_rate_run_status.drop(op.get_bind(), checkfirst=True)

    op.execute("DELETE FROM transactions")
    op.execute("DELETE FROM recurring_transactions")
    op.execute("DELETE FROM shopping_items")
    op.execute("DELETE FROM shopping_lists")
    op.execute("DELETE FROM shopping_template_items")
    op.execute("DELETE FROM shopping_templates")
    op.execute("DELETE FROM accounts")

    op.execute(
        "ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_currency_code_fkey"
    )
    op.add_column(
        "currencies",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=True),
    )
    op.execute("ALTER TABLE currencies DROP CONSTRAINT IF EXISTS pk_currencies")
    op.execute(
        """
        WITH numbered AS (
            SELECT code, row_number() OVER (ORDER BY code) AS rn
            FROM currencies
        )
        UPDATE currencies c
        SET id = numbered.rn
        FROM numbered
        WHERE c.code = numbered.code
        """
    )
    op.execute("ALTER TABLE currencies ALTER COLUMN id SET NOT NULL")
    op.create_primary_key("currencies_pkey", "currencies", ["id"])
    op.create_index("ix_currencies_code", "currencies", ["code"], unique=True)

    op.add_column(
        "accounts",
        sa.Column("currency_id", sa.Integer(), nullable=False, server_default="1"),
    )
    op.execute(
        "ALTER TABLE accounts ADD CONSTRAINT accounts_currency_id_fkey FOREIGN KEY (currency_id) REFERENCES currencies (id)"
    )
    op.alter_column("accounts", "currency_id", server_default=None)
    op.drop_column("accounts", "currency_code")
