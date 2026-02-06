from datetime import date, datetime
from decimal import Decimal
from enum import Enum

from sqlalchemy import (
    Date,
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    String,
    UniqueConstraint,
)
from sqlalchemy import Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel as ORMBaseModel


class ExchangeRateSource(str, Enum):
    """Источник обменного курса."""

    ECB = "ECB"
    CBR = "CBR"


class ExchangeRateRunStatus(str, Enum):
    """Статус запуска коллектора курсов."""

    RUNNING = "running"
    COMPLETED = "completed"
    COMPLETED_WITH_ERRORS = "completed_with_errors"
    FAILED = "failed"


class ExchangeRateRun(ORMBaseModel):
    """Запуск фонового сбора курсов."""

    __tablename__ = "exchange_rate_runs"

    id: Mapped[int] = mapped_column(primary_key=True)
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    finished_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    status: Mapped[ExchangeRateRunStatus] = mapped_column(
        SQLEnum(ExchangeRateRunStatus),
        default=ExchangeRateRunStatus.RUNNING,
        nullable=False,
    )
    base_date: Mapped[date] = mapped_column(Date, nullable=False)
    timezone: Mapped[str] = mapped_column(String(50), default="UTC", nullable=False)
    pairs_total: Mapped[int] = mapped_column(default=0, nullable=False)
    pairs_saved: Mapped[int] = mapped_column(default=0, nullable=False)
    pairs_skipped: Mapped[int] = mapped_column(default=0, nullable=False)
    error_count: Mapped[int] = mapped_column(default=0, nullable=False)
    error_summary: Mapped[str | None] = mapped_column(nullable=True)

    rates = relationship("ExchangeRate", back_populates="run")


class ExchangeRate(ORMBaseModel):
    """Историческая запись курса обмена для валютной пары."""

    __tablename__ = "exchange_rates"
    __table_args__ = (
        UniqueConstraint(
            "run_id",
            "from_currency_code",
            "to_currency_code",
            "source",
            name="uq_exchange_rates_run_pair_source",
        ),
        Index(
            "ix_exchange_rates_pair_effective_at",
            "from_currency_code",
            "to_currency_code",
            "effective_at",
        ),
        Index("ix_exchange_rates_effective_at", "effective_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    run_id: Mapped[int] = mapped_column(
        ForeignKey("exchange_rate_runs.id"), nullable=False
    )
    from_currency_code: Mapped[str] = mapped_column(
        String(10),
        ForeignKey("currencies.code"),
        nullable=False,
    )
    to_currency_code: Mapped[str] = mapped_column(
        String(10),
        ForeignKey("currencies.code"),
        nullable=False,
    )
    source: Mapped[ExchangeRateSource] = mapped_column(
        SQLEnum(ExchangeRateSource), nullable=False
    )
    rate: Mapped[Decimal] = mapped_column(Numeric(24, 12), nullable=False)
    effective_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    is_backfill: Mapped[bool] = mapped_column(default=False, nullable=False)

    run = relationship("ExchangeRateRun", back_populates="rates")
