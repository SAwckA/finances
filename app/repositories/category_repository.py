from typing import Sequence

from app.models.category import Category, CategoryType
from app.repositories.base_repository import BaseRepository


class CategoryRepository(BaseRepository[Category]):
    """Репозиторий для работы с категориями."""

    async def get_by_workspace_id(
        self,
        workspace_id: int,
        skip: int = 0,
        limit: int = 100,
    ) -> Sequence[Category]:
        """Получить все категории рабочего пространства."""
        return await self.get_many_by(
            workspace_id=workspace_id,
            skip=skip,
            limit=limit,
        )

    async def get_by_workspace_and_type(
        self,
        workspace_id: int,
        category_type: CategoryType,
        skip: int = 0,
        limit: int = 100,
    ) -> Sequence[Category]:
        """Получить категории рабочего пространства по типу."""
        return await self.get_many_by(
            workspace_id=workspace_id,
            type=category_type,
            skip=skip,
            limit=limit,
        )

    async def get_workspace_category(
        self,
        workspace_id: int,
        category_id: int,
    ) -> Category | None:
        """Получить конкретную категорию рабочего пространства."""
        return await self.get_by(workspace_id=workspace_id, id=category_id)
