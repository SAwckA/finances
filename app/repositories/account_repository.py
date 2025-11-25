from typing import Sequence

from app.models.account import Account
from app.repositories.base_repository import BaseRepository


class AccountRepository(BaseRepository[Account]):
    """Репозиторий для работы со счетами."""

    async def get_by_user_id(
        self,
        user_id: int,
        skip: int = 0,
        limit: int = 100,
    ) -> Sequence[Account]:
        """Получить все счета пользователя."""
        return await self.get_many_by(user_id=user_id, skip=skip, limit=limit)

    async def get_user_account(self, user_id: int, account_id: int) -> Account | None:
        """Получить конкретный счёт пользователя."""
        return await self.get_by(user_id=user_id, id=account_id)
