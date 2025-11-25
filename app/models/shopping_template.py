from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field
from sqlalchemy import ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import SoftDeleteModel


# === PYDANTIC SCHEMAS ===


class ShoppingTemplateItemBase(BaseModel):
    """Базовая схема товара в шаблоне."""

    name: str = Field(min_length=1, max_length=200, description="Название товара")
    default_quantity: int = Field(default=1, ge=1, description="Количество по умолчанию")
    default_price: Decimal | None = Field(None, ge=0, description="Цена по умолчанию")


class ShoppingTemplateItemCreate(ShoppingTemplateItemBase):
    """Схема для создания товара в шаблоне."""

    pass


class ShoppingTemplateItemUpdate(BaseModel):
    """Схема для обновления товара в шаблоне."""

    name: str | None = Field(None, min_length=1, max_length=200)
    default_quantity: int | None = Field(None, ge=1)
    default_price: Decimal | None = Field(None, ge=0)


class ShoppingTemplateItemResponse(ShoppingTemplateItemBase):
    """Схема ответа с данными товара в шаблоне."""

    id: int
    template_id: int

    model_config = {"from_attributes": True}


class ShoppingTemplateBase(BaseModel):
    """Базовая схема шаблона списка покупок."""

    name: str = Field(min_length=1, max_length=100, description="Название шаблона")
    color: str = Field(
        min_length=4,
        max_length=7,
        pattern=r"^#[0-9A-Fa-f]{3,6}$",
        description="Цвет в формате HEX",
    )
    icon: str = Field(min_length=1, max_length=50, description="Название иконки")
    default_account_id: int | None = Field(None, description="ID счёта по умолчанию")
    default_category_id: int | None = Field(None, description="ID категории по умолчанию")


class ShoppingTemplateCreate(ShoppingTemplateBase):
    """Схема для создания шаблона."""

    items: list[ShoppingTemplateItemCreate] = Field(default_factory=list)


class ShoppingTemplateUpdate(BaseModel):
    """Схема для обновления шаблона."""

    name: str | None = Field(None, min_length=1, max_length=100)
    color: str | None = Field(None, min_length=4, max_length=7, pattern=r"^#[0-9A-Fa-f]{3,6}$")
    icon: str | None = Field(None, min_length=1, max_length=50)
    default_account_id: int | None = None
    default_category_id: int | None = None


class ShoppingTemplateResponse(ShoppingTemplateBase):
    """Схема ответа с данными шаблона."""

    id: int
    user_id: int
    created_at: datetime
    items: list[ShoppingTemplateItemResponse] = Field(default_factory=list)

    model_config = {"from_attributes": True}


# === ORM MODELS ===


class ShoppingTemplate(SoftDeleteModel):
    """ORM модель шаблона списка покупок."""

    __tablename__ = "shopping_templates"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)

    name: Mapped[str] = mapped_column(String(100))
    color: Mapped[str] = mapped_column(String(7))
    icon: Mapped[str] = mapped_column(String(50))

    default_account_id: Mapped[int | None] = mapped_column(
        ForeignKey("accounts.id"), nullable=True
    )
    default_category_id: Mapped[int | None] = mapped_column(
        ForeignKey("categories.id"), nullable=True
    )

    user = relationship("User")
    default_account = relationship("Account")
    default_category = relationship("Category")
    items = relationship(
        "ShoppingTemplateItem",
        back_populates="template",
        cascade="all, delete-orphan",
    )


class ShoppingTemplateItem(SoftDeleteModel):
    """ORM модель товара в шаблоне."""

    __tablename__ = "shopping_template_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    template_id: Mapped[int] = mapped_column(
        ForeignKey("shopping_templates.id", ondelete="CASCADE"), index=True
    )

    name: Mapped[str] = mapped_column(String(200))
    default_quantity: Mapped[int] = mapped_column(Integer, default=1)
    default_price: Mapped[Decimal | None] = mapped_column(Numeric(18, 2), nullable=True)

    template = relationship("ShoppingTemplate", back_populates="items")

