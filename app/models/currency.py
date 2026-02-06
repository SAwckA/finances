from datetime import datetime

from pydantic import BaseModel, Field
from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import BaseModel as ORMBaseModel


# === PYDANTIC SCHEMAS ===


class CurrencyBase(BaseModel):
    """Базовая схема валюты."""

    code: str = Field(min_length=2, max_length=10, description="Код валюты")
    name: str = Field(min_length=1, max_length=100, description="Название валюты")
    symbol: str = Field(min_length=1, max_length=5, description="Символ валюты")


class CurrencyCreate(CurrencyBase):
    """Схема для создания валюты."""

    pass


class CurrencyUpdate(BaseModel):
    """Схема для обновления валюты."""

    code: str | None = Field(None, min_length=2, max_length=10)
    name: str | None = Field(None, min_length=1, max_length=100)
    symbol: str | None = Field(None, min_length=1, max_length=5)


class CurrencyResponse(CurrencyBase):
    """Схема ответа с данными валюты."""

    created_at: datetime

    model_config = {"from_attributes": True}


# === ORM MODEL ===


class Currency(ORMBaseModel):
    """ORM модель валюты (справочник)."""

    __tablename__ = "currencies"

    code: Mapped[str] = mapped_column(String(10), primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    symbol: Mapped[str] = mapped_column(String(5))
