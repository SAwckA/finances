import logging

from app.exceptions import ForbiddenException, NotFoundException
from app.models.category import CategoryCreate, CategoryType, CategoryUpdate
from app.repositories.category_repository import CategoryRepository
from app.services.base_service import BaseService

logger = logging.getLogger(__name__)


# === EXCEPTIONS ===


class CategoryNotFoundException(NotFoundException):
    """Категория не найдена."""

    message = "Категория не найдена"


class CategoryAccessDeniedException(ForbiddenException):
    """Доступ к категории запрещён."""

    message = "Доступ к категории запрещён"


# === SERVICE ===


class CategoryService(BaseService):
    """Сервис для работы с категориями."""

    category_repository: CategoryRepository

    async def get_user_categories(
        self,
        user_id: int,
        category_type: CategoryType | None = None,
        skip: int = 0,
        limit: int = 100,
    ):
        """Получить категории пользователя."""
        if category_type:
            return await self.category_repository.get_by_user_and_type(
                user_id=user_id, category_type=category_type, skip=skip, limit=limit
            )
        return await self.category_repository.get_by_user_id(
            user_id=user_id, skip=skip, limit=limit
        )

    async def get_by_id(self, category_id: int, user_id: int):
        """Получить категорию по ID с проверкой доступа."""
        category = await self.category_repository.get_by_id(category_id)
        if not category:
            raise CategoryNotFoundException(details={"category_id": category_id})
        if category.user_id != user_id:
            raise CategoryAccessDeniedException(details={"category_id": category_id})
        return category

    async def create(self, user_id: int, data: CategoryCreate):
        """Создать новую категорию."""
        category_data = data.model_dump()
        category_data["user_id"] = user_id
        logger.info(f"Creating category '{data.name}' for user {user_id}")
        return await self.category_repository.create(category_data)

    async def update(self, category_id: int, user_id: int, data: CategoryUpdate):
        """Обновить категорию."""
        category = await self.get_by_id(category_id, user_id)
        update_data = data.model_dump(exclude_unset=True)
        updated = await self.category_repository.update(category.id, update_data)
        logger.info(f"Updated category {category_id}")
        return updated

    async def delete(self, category_id: int, user_id: int) -> bool:
        """Удалить категорию."""
        await self.get_by_id(category_id, user_id)
        result = await self.category_repository.delete(category_id)
        logger.info(f"Deleted category {category_id}")
        return result
