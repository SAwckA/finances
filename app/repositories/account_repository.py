from typing import Sequence

from app.models.account import Account
from app.repositories.base_repository import BaseRepository


class AccountRepository(BaseRepository[Account]):
    """Репозиторий для работы со счетами."""

    async def get_by_workspace_id(
        self,
        workspace_id: int,
        skip: int = 0,
        limit: int = 100,
    ) -> Sequence[Account]:
        """Получить все счета рабочего пространства."""
        return await self.get_many_by(
            workspace_id=workspace_id,
            skip=skip,
            limit=limit,
        )

    async def get_workspace_account(
        self,
        workspace_id: int,
        account_id: int,
    ) -> Account | None:
        """Получить конкретный счёт рабочего пространства."""
        return await self.get_by(workspace_id=workspace_id, id=account_id)
