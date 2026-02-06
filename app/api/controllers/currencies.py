from decimal import Decimal

from fastapi import APIRouter, Query
from pydantic import BaseModel, Field

from app.models.currency import CurrencyCreate, CurrencyResponse, CurrencyUpdate
from app.services.exchange_rate_service import ExchangeRateService
from app.services.currency_service import CurrencyService

router = APIRouter(prefix="/currencies", tags=["currencies"])


class ExchangeRateResponse(BaseModel):
    """Схема ответа с курсом валют."""

    from_currency: str = Field(description="Исходная валюта")
    to_currency: str = Field(description="Целевая валюта")
    rate: Decimal = Field(description="Курс обмена")


@router.get("", response_model=list[CurrencyResponse])
async def get_currencies(skip: int = 0, limit: int = 100):
    """Получить список всех валют."""
    async with CurrencyService() as service:
        return await service.get_all(skip=skip, limit=limit)


@router.get("/rate", response_model=ExchangeRateResponse)
async def get_exchange_rate(
    from_currency: str = Query(..., description="Исходная валюта"),
    to_currency: str = Query(..., description="Целевая валюта"),
):
    """Получить курс обмена между двумя валютами."""
    async with ExchangeRateService() as service:
        rate = await service.get_rate(from_currency, to_currency)
        return ExchangeRateResponse(
            from_currency=from_currency.upper(),
            to_currency=to_currency.upper(),
            rate=rate,
        )


@router.get("/{currency_id}", response_model=CurrencyResponse)
async def get_currency(currency_id: int):
    """Получить валюту по ID."""
    async with CurrencyService() as service:
        return await service.get_by_id(currency_id)


@router.get("/code/{code}", response_model=CurrencyResponse)
async def get_currency_by_code(code: str):
    """Получить валюту по коду."""
    async with CurrencyService() as service:
        return await service.get_by_code(code)


@router.post("", response_model=CurrencyResponse, status_code=201)
async def create_currency(data: CurrencyCreate):
    """Создать новую валюту."""
    async with CurrencyService() as service:
        return await service.create(data)


@router.patch("/{currency_id}", response_model=CurrencyResponse)
async def update_currency(currency_id: int, data: CurrencyUpdate):
    """Обновить валюту."""
    async with CurrencyService() as service:
        return await service.update(currency_id, data)


@router.delete("/{currency_id}", status_code=204)
async def delete_currency(currency_id: int):
    """Удалить валюту."""
    async with CurrencyService() as service:
        await service.delete(currency_id)
