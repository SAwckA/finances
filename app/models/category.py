from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field
from sqlalchemy import ForeignKey, String
from sqlalchemy import Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import SoftDeleteModel


# === ENUMS ===


class CategoryType(str, Enum):
    """Тип категории."""

    INCOME = "income"
    EXPENSE = "expense"


# === PYDANTIC SCHEMAS ===


class CategoryBase(BaseModel):
    """Базовая схема категории."""

    name: str = Field(min_length=1, max_length=100, description="Название категории")
    color: str = Field(
        min_length=4,
        max_length=7,
        pattern=r"^#[0-9A-Fa-f]{3,6}$",
        description="Цвет в формате HEX",
    )
    icon: str = Field(min_length=1, max_length=50, description="Название иконки")
    type: CategoryType = Field(description="Тип категории (доход/расход)")


class CategoryCreate(CategoryBase):
    """Схема для создания категории."""

    pass


class CategoryUpdate(BaseModel):
    """Схема для обновления категории."""

    name: str | None = Field(None, min_length=1, max_length=100)
    color: str | None = Field(None, min_length=4, max_length=7, pattern=r"^#[0-9A-Fa-f]{3,6}$")
    icon: str | None = Field(None, min_length=1, max_length=50)
    type: CategoryType | None = None


class CategoryResponse(CategoryBase):
    """Схема ответа с данными категории."""

    id: int
    user_id: int
    created_at: datetime

    model_config = {"from_attributes": True}


# === ORM MODEL ===


class Category(SoftDeleteModel):
    """ORM модель категории транзакций."""

    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    name: Mapped[str] = mapped_column(String(100))
    color: Mapped[str] = mapped_column(String(7))
    icon: Mapped[str] = mapped_column(String(50))
    type: Mapped[CategoryType] = mapped_column(SQLEnum(CategoryType))

    user = relationship("User", back_populates="categories")

