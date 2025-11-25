from datetime import datetime
from decimal import Decimal
from enum import Enum

from pydantic import BaseModel, Field
from sqlalchemy import DateTime, ForeignKey, Numeric, String, Text
from sqlalchemy import Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import SoftDeleteModel


# === ENUMS ===


class TransactionType(str, Enum):
    """Тип транзакции."""

    INCOME = "income"
    EXPENSE = "expense"
    TRANSFER = "transfer"


# === PYDANTIC SCHEMAS ===


class TransactionBase(BaseModel):
    """Базовая схема транзакции."""

    type: TransactionType = Field(description="Тип транзакции")
    account_id: int = Field(description="ID счёта")
    amount: Decimal = Field(gt=0, description="Сумма транзакции")
    description: str | None = Field(None, max_length=500, description="Описание")
    transaction_date: datetime = Field(description="Дата транзакции")


class TransactionCreate(TransactionBase):
    """Схема для создания транзакции."""

    target_account_id: int | None = Field(None, description="ID целевого счёта (для переводов)")
    category_id: int | None = Field(None, description="ID категории")


class TransactionUpdate(BaseModel):
    """Схема для обновления транзакции."""

    amount: Decimal | None = Field(None, gt=0)
    description: str | None = Field(None, max_length=500)
    transaction_date: datetime | None = None
    category_id: int | None = None


class TransactionResponse(BaseModel):
    """Схема ответа с данными транзакции."""

    id: int
    user_id: int
    type: TransactionType
    account_id: int
    target_account_id: int | None
    category_id: int | None
    amount: Decimal
    converted_amount: Decimal | None
    exchange_rate: Decimal | None
    description: str | None
    transaction_date: datetime
    shopping_list_id: int | None
    created_at: datetime

    model_config = {"from_attributes": True}


# === ORM MODEL ===


class Transaction(SoftDeleteModel):
    """ORM модель транзакции."""

    __tablename__ = "transactions"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    type: Mapped[TransactionType] = mapped_column(SQLEnum(TransactionType), index=True)

    account_id: Mapped[int] = mapped_column(ForeignKey("accounts.id"), index=True)
    target_account_id: Mapped[int | None] = mapped_column(
        ForeignKey("accounts.id"), nullable=True
    )

    category_id: Mapped[int | None] = mapped_column(
        ForeignKey("categories.id"), nullable=True, index=True
    )

    amount: Mapped[Decimal] = mapped_column(Numeric(18, 2))
    converted_amount: Mapped[Decimal | None] = mapped_column(Numeric(18, 2), nullable=True)
    exchange_rate: Mapped[Decimal | None] = mapped_column(Numeric(18, 8), nullable=True)

    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    transaction_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)

    shopping_list_id: Mapped[int | None] = mapped_column(
        ForeignKey("shopping_lists.id"), nullable=True
    )

    user = relationship("User")
    account = relationship("Account", foreign_keys=[account_id])
    target_account = relationship("Account", foreign_keys=[target_account_id])
    category = relationship("Category")
    shopping_list = relationship("ShoppingList", back_populates="transaction")

