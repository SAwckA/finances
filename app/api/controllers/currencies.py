from fastapi import APIRouter

from app.models.currency import CurrencyCreate, CurrencyResponse, CurrencyUpdate
from app.services.currency_service import CurrencyService

router = APIRouter(prefix="/currencies", tags=["currencies"])


@router.get("", response_model=list[CurrencyResponse])
async def get_currencies(skip: int = 0, limit: int = 100):
    """Получить список всех валют."""
    async with CurrencyService() as service:
        return await service.get_all(skip=skip, limit=limit)


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
