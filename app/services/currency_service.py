import logging

from app.exceptions import ConflictException, NotFoundException
from app.models.currency import CurrencyCreate, CurrencyUpdate
from app.repositories.currency_repository import CurrencyRepository
from app.services.base_service import BaseService

logger = logging.getLogger(__name__)


# === EXCEPTIONS ===


class CurrencyNotFoundException(NotFoundException):
    """Валюта не найдена."""

    message = "Валюта не найдена"


class CurrencyCodeExistsException(ConflictException):
    """Валюта с таким кодом уже существует."""

    message = "Валюта с таким кодом уже существует"


# === SERVICE ===


class CurrencyService(BaseService):
    """Сервис для работы с валютами."""

    currency_repository: CurrencyRepository

    async def get_all(self, skip: int = 0, limit: int = 100):
        """Получить список всех валют."""
        return await self.currency_repository.get_all(skip=skip, limit=limit)

    async def get_by_code(self, code: str):
        """Получить валюту по коду."""
        normalized_code = code.upper()
        currency = await self.currency_repository.get_by_code(normalized_code)
        if not currency:
            raise CurrencyNotFoundException(details={"code": normalized_code})
        return currency

    async def create(self, data: CurrencyCreate):
        """Создать новую валюту."""
        existing = await self.currency_repository.get_by_code(data.code.upper())
        if existing:
            raise CurrencyCodeExistsException(details={"code": data.code})

        currency_data = data.model_dump()
        currency_data["code"] = currency_data["code"].upper()
        logger.info(f"Creating currency: {currency_data['code']}")
        return await self.currency_repository.create(currency_data)

    async def update(self, code: str, data: CurrencyUpdate):
        """Обновить валюту."""
        normalized_code = code.upper()
        currency = await self.currency_repository.get_by_code(normalized_code)
        if not currency:
            raise CurrencyNotFoundException(details={"code": normalized_code})

        update_data = data.model_dump(exclude_unset=True)
        if "code" in update_data:
            update_data["code"] = update_data["code"].upper()
            existing = await self.currency_repository.get_by_code(update_data["code"])
            if existing and existing.code != normalized_code:
                raise CurrencyCodeExistsException(details={"code": update_data["code"]})

        return await self.currency_repository.update_by_code(
            normalized_code, update_data
        )

    async def delete(self, code: str) -> bool:
        """Удалить валюту."""
        normalized_code = code.upper()
        currency = await self.currency_repository.get_by_code(normalized_code)
        if not currency:
            raise CurrencyNotFoundException(details={"code": normalized_code})
        return await self.currency_repository.delete_by_code(normalized_code)
