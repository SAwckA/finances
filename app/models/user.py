from datetime import datetime

from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import SoftDeleteModel


class UserBase(BaseModel):
    """Базовая схема пользователя."""

    email: EmailStr
    name: str = Field(min_length=2, max_length=100)


class UserCreate(UserBase):
    """Схема для создания пользователя."""

    password: str = Field(min_length=8)


class UserUpdate(BaseModel):
    """Схема для обновления пользователя."""

    email: EmailStr | None = None
    name: str | None = None


class UserResponse(UserBase):
    """Схема ответа с данными пользователя."""

    id: int
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class User(SoftDeleteModel):
    """ORM модель пользователя."""

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(100))
    hashed_password: Mapped[str] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(default=True)

    accounts = relationship("Account", back_populates="user")
    categories = relationship("Category", back_populates="user")
