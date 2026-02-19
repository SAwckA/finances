from datetime import datetime

from pydantic import BaseModel, Field
from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import SoftDeleteModel


# === PYDANTIC SCHEMAS ===


class AccountBase(BaseModel):
    """Базовая схема счёта."""

    name: str = Field(min_length=1, max_length=100, description="Название счёта")
    color: str = Field(
        min_length=4,
        max_length=7,
        pattern=r"^#[0-9A-Fa-f]{3,6}$",
        description="Цвет в формате HEX",
    )
    icon: str = Field(min_length=1, max_length=50, description="Название иконки")
    currency_code: str = Field(min_length=2, max_length=10, description="Код валюты")
    short_identifier: str | None = Field(
        None,
        max_length=20,
        description="Краткий идентификатор (последние 4 цифры карты и т.п.)",
    )


class AccountCreate(AccountBase):
    """Схема для создания счёта."""

    pass


class AccountUpdate(BaseModel):
    """Схема для обновления счёта."""

    name: str | None = Field(None, min_length=1, max_length=100)
    color: str | None = Field(
        None, min_length=4, max_length=7, pattern=r"^#[0-9A-Fa-f]{3,6}$"
    )
    icon: str | None = Field(None, min_length=1, max_length=50)
    currency_code: str | None = Field(None, min_length=2, max_length=10)
    short_identifier: str | None = Field(None, max_length=20)


class AccountResponse(AccountBase):
    """Схема ответа с данными счёта."""

    id: int
    workspace_id: int
    created_at: datetime

    model_config = {"from_attributes": True}


# === ORM MODEL ===


class Account(SoftDeleteModel):
    """ORM модель счёта пользователя."""

    __tablename__ = "accounts"

    id: Mapped[int] = mapped_column(primary_key=True)
    workspace_id: Mapped[int] = mapped_column(ForeignKey("workspaces.id"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    name: Mapped[str] = mapped_column(String(100))
    color: Mapped[str] = mapped_column(String(7))
    icon: Mapped[str] = mapped_column(String(50))
    currency_code: Mapped[str] = mapped_column(ForeignKey("currencies.code"))
    short_identifier: Mapped[str | None] = mapped_column(String(20), nullable=True)

    user = relationship("User", back_populates="accounts")
    workspace = relationship("Workspace")
    currency = relationship("Currency")
