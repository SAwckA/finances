from datetime import date, datetime
from decimal import Decimal
from enum import Enum

from pydantic import BaseModel, Field
from sqlalchemy import Date, DateTime, ForeignKey, Integer, Numeric, Text
from sqlalchemy import Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import SoftDeleteModel
from app.models.transaction import TransactionType


# === ENUMS ===


class RecurringFrequency(str, Enum):
    """Периодичность повторения."""

    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"


# === PYDANTIC SCHEMAS ===


class RecurringTransactionBase(BaseModel):
    """Базовая схема периодической транзакции."""

    type: TransactionType = Field(description="Тип транзакции (income/expense)")
    account_id: int = Field(description="ID счёта")
    category_id: int = Field(description="ID категории")
    amount: Decimal = Field(gt=0, description="Сумма транзакции")
    description: str | None = Field(None, max_length=500, description="Описание")

    frequency: RecurringFrequency = Field(description="Периодичность")
    day_of_week: int | None = Field(
        None, ge=0, le=6, description="День недели (0=пн, 6=вс) для weekly"
    )
    day_of_month: int | None = Field(
        None, ge=1, le=31, description="День месяца для monthly"
    )

    start_date: date = Field(description="Дата начала")
    end_date: date | None = Field(None, description="Дата окончания (опционально)")


class RecurringTransactionCreate(RecurringTransactionBase):
    """Схема для создания периодической транзакции."""

    pass


class RecurringTransactionUpdate(BaseModel):
    """Схема для обновления периодической транзакции."""

    amount: Decimal | None = Field(None, gt=0)
    description: str | None = Field(None, max_length=500)
    category_id: int | None = None

    frequency: RecurringFrequency | None = None
    day_of_week: int | None = Field(None, ge=0, le=6)
    day_of_month: int | None = Field(None, ge=1, le=31)

    end_date: date | None = None
    is_active: bool | None = None


class RecurringTransactionResponse(RecurringTransactionBase):
    """Схема ответа с данными периодической транзакции."""

    id: int
    workspace_id: int
    is_active: bool
    next_execution_date: date
    last_executed_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


# === ORM MODEL ===


class RecurringTransaction(SoftDeleteModel):
    """ORM модель периодической транзакции."""

    __tablename__ = "recurring_transactions"

    id: Mapped[int] = mapped_column(primary_key=True)
    workspace_id: Mapped[int] = mapped_column(ForeignKey("workspaces.id"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)

    type: Mapped[TransactionType] = mapped_column(SQLEnum(TransactionType))
    account_id: Mapped[int] = mapped_column(ForeignKey("accounts.id"))
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id"))

    amount: Mapped[Decimal] = mapped_column(Numeric(18, 2))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    frequency: Mapped[RecurringFrequency] = mapped_column(SQLEnum(RecurringFrequency))
    day_of_week: Mapped[int | None] = mapped_column(Integer, nullable=True)
    day_of_month: Mapped[int | None] = mapped_column(Integer, nullable=True)

    start_date: Mapped[date] = mapped_column(Date)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    next_execution_date: Mapped[date] = mapped_column(Date, index=True)
    last_executed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    is_active: Mapped[bool] = mapped_column(default=True, index=True)

    user = relationship("User")
    workspace = relationship("Workspace")
    account = relationship("Account")
    category = relationship("Category")
    transactions = relationship("Transaction", back_populates="recurring_transaction")
