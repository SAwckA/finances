from sqlalchemy import delete, select, update

from app.models.currency import Currency
from app.repositories.base_repository import BaseRepository


class CurrencyRepository(BaseRepository[Currency]):
    """Репозиторий для работы с валютами."""

    async def get_by_code(self, code: str) -> Currency | None:
        """Получить валюту по коду."""
        return await self.get_by(code=code)

    async def update_by_code(self, code: str, data: dict) -> Currency | None:
        """Обновить валюту по коду."""
        update_data = {k: v for k, v in data.items() if v is not None}
        if not update_data:
            return await self.get_by_code(code)

        result = await self.session.execute(
            update(Currency)
            .where(Currency.code == code)
            .values(**update_data)
            .returning(Currency)
        )
        await self.session.flush()
        return result.scalar_one_or_none()

    async def delete_by_code(self, code: str) -> bool:
        """Удалить валюту по коду."""
        result = await self.session.execute(
            delete(Currency).where(Currency.code == code)
        )
        return result.rowcount > 0  # type: ignore[union-attr]

    async def get_all_codes(self) -> list[str]:
        """Получить список кодов валют."""
        result = await self.session.execute(select(Currency.code))
        return list(result.scalars().all())
