from datetime import datetime
from decimal import Decimal
from enum import Enum

from pydantic import BaseModel, Field
from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy import Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import SoftDeleteModel


# === ENUMS ===


class ShoppingListStatus(str, Enum):
    """Статус списка покупок."""

    DRAFT = "draft"
    CONFIRMED = "confirmed"
    COMPLETED = "completed"


# === PYDANTIC SCHEMAS ===


class ShoppingItemBase(BaseModel):
    """Базовая схема товара в списке."""

    name: str = Field(min_length=1, max_length=200, description="Название товара")
    quantity: int = Field(default=1, ge=1, description="Количество")
    price: Decimal | None = Field(None, ge=0, description="Цена за единицу")


class ShoppingItemCreate(ShoppingItemBase):
    """Схема для создания товара."""

    pass


class ShoppingItemUpdate(BaseModel):
    """Схема для обновления товара."""

    name: str | None = Field(None, min_length=1, max_length=200)
    quantity: int | None = Field(None, ge=1)
    price: Decimal | None = Field(None, ge=0)
    is_checked: bool | None = None


class ShoppingItemResponse(ShoppingItemBase):
    """Схема ответа с данными товара."""

    id: int
    shopping_list_id: int
    is_checked: bool
    total_price: Decimal | None

    model_config = {"from_attributes": True}


class ShoppingListBase(BaseModel):
    """Базовая схема списка покупок."""

    name: str = Field(min_length=1, max_length=100, description="Название списка")
    account_id: int = Field(description="ID счёта для списания")
    category_id: int = Field(description="ID категории")


class ShoppingListCreate(ShoppingListBase):
    """Схема для создания списка покупок."""

    items: list[ShoppingItemCreate] = Field(default_factory=list)


class ShoppingListUpdate(BaseModel):
    """Схема для обновления списка покупок."""

    name: str | None = Field(None, min_length=1, max_length=100)
    account_id: int | None = None
    category_id: int | None = None


class ShoppingListResponse(ShoppingListBase):
    """Схема ответа с данными списка покупок."""

    id: int
    user_id: int
    status: ShoppingListStatus
    total_amount: Decimal | None
    confirmed_at: datetime | None
    completed_at: datetime | None
    transaction_id: int | None
    created_at: datetime
    items: list[ShoppingItemResponse] = Field(default_factory=list)

    model_config = {"from_attributes": True}


# === ORM MODELS ===


class ShoppingList(SoftDeleteModel):
    """ORM модель списка покупок."""

    __tablename__ = "shopping_lists"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    name: Mapped[str] = mapped_column(String(100))

    account_id: Mapped[int] = mapped_column(ForeignKey("accounts.id"))
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id"))

    status: Mapped[ShoppingListStatus] = mapped_column(
        SQLEnum(ShoppingListStatus), default=ShoppingListStatus.DRAFT, index=True
    )

    total_amount: Mapped[Decimal | None] = mapped_column(Numeric(18, 2), nullable=True)
    confirmed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    user = relationship("User")
    account = relationship("Account")
    category = relationship("Category")
    items = relationship(
        "ShoppingItem", back_populates="shopping_list", cascade="all, delete-orphan"
    )
    transaction = relationship("Transaction", back_populates="shopping_list", uselist=False)

    @property
    def transaction_id(self) -> int | None:
        """ID связанной транзакции."""
        return self.transaction.id if self.transaction else None


class ShoppingItem(SoftDeleteModel):
    """ORM модель товара в списке покупок."""

    __tablename__ = "shopping_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    shopping_list_id: Mapped[int] = mapped_column(
        ForeignKey("shopping_lists.id", ondelete="CASCADE"), index=True
    )

    name: Mapped[str] = mapped_column(String(200))
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    price: Mapped[Decimal | None] = mapped_column(Numeric(18, 2), nullable=True)
    is_checked: Mapped[bool] = mapped_column(default=False)

    shopping_list = relationship("ShoppingList", back_populates="items")

    @property
    def total_price(self) -> Decimal | None:
        """Общая стоимость позиции."""
        if self.price is None:
            return None
        return self.price * self.quantity

