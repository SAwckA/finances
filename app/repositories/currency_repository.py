from app.models.currency import Currency
from app.repositories.base_repository import BaseRepository


class CurrencyRepository(BaseRepository[Currency]):
    """Репозиторий для работы с валютами."""

    async def get_by_code(self, code: str) -> Currency | None:
        """Получить валюту по коду."""
        return await self.get_by(code=code)
