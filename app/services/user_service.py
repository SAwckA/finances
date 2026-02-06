import logging

from app.exceptions import NotFoundException
from app.models.user import User, UserUpdate
from app.repositories.user_repository import UserRepository
from app.services.base_service import BaseService

logger = logging.getLogger(__name__)


class UserNotFoundException(NotFoundException):
    message = "Пользователь не найден"


class UserService(BaseService):
    """Сервис для работы с пользователями."""

    user_repository: UserRepository

    async def get_user_by_id(self, user_id: int) -> User:
        """Получение пользователя по ID."""
        user = await self.user_repository.get_by_id(user_id)
        if not user:
            raise UserNotFoundException(details={"user_id": user_id})
        return user

    async def update_user(self, user_id: int, data: UserUpdate) -> User:
        """Обновление данных пользователя."""
        await self.get_user_by_id(user_id)

        update_data = data.model_dump(exclude_unset=True)
        updated_user = await self.user_repository.update(user_id, update_data)

        logger.info(f"User updated: id={user_id}")
        return updated_user

    async def delete_user(self, user_id: int) -> bool:
        """Удаление пользователя (soft delete)."""
        await self.get_user_by_id(user_id)

        result = await self.user_repository.delete(user_id)
        logger.info(f"User deleted: id={user_id}")

        return result

    async def get_users(self, skip: int = 0, limit: int = 100) -> list[User]:
        """Получение списка пользователей."""
        users = await self.user_repository.get_all(skip=skip, limit=limit)
        return list(users)
