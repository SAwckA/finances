from typing import Sequence

from app.models.category import Category, CategoryType
from app.repositories.base_repository import BaseRepository


class CategoryRepository(BaseRepository[Category]):
    """Репозиторий для работы с категориями."""

    async def get_by_user_id(
        self,
        user_id: int,
        skip: int = 0,
        limit: int = 100,
    ) -> Sequence[Category]:
        """Получить все категории пользователя."""
        return await self.get_many_by(user_id=user_id, skip=skip, limit=limit)

    async def get_by_user_and_type(
        self,
        user_id: int,
        category_type: CategoryType,
        skip: int = 0,
        limit: int = 100,
    ) -> Sequence[Category]:
        """Получить категории пользователя по типу."""
        return await self.get_many_by(
            user_id=user_id, type=category_type, skip=skip, limit=limit
        )

    async def get_user_category(
        self, user_id: int, category_id: int
    ) -> Category | None:
        """Получить конкретную категорию пользователя."""
        return await self.get_by(user_id=user_id, id=category_id)
