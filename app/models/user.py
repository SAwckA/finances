from datetime import datetime

from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import SoftDeleteModel


class UserBase(BaseModel):
    """Базовая схема пользователя."""

    email: EmailStr
    name: str = Field(min_length=2, max_length=100)


class UserUpdate(BaseModel):
    """Схема для обновления пользователя."""

    name: str | None = None


class UserResponse(UserBase):
    """Схема ответа с данными пользователя."""

    id: int
    auth_provider: str
    avatar_url: str | None = None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class User(SoftDeleteModel):
    """ORM модель пользователя."""

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(100))
    hashed_password: Mapped[str | None] = mapped_column(String(255), nullable=True)
    auth_provider: Mapped[str] = mapped_column(String(50), default="google")
    google_sub: Mapped[str | None] = mapped_column(
        String(255),
        unique=True,
        index=True,
        nullable=True,
    )
    avatar_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    is_active: Mapped[bool] = mapped_column(default=True)

    accounts = relationship("Account", back_populates="user")
    categories = relationship("Category", back_populates="user")
