import logging

from app.auth.password import hash_password
from app.exceptions import ConflictException, NotFoundException
from app.models.user import User, UserCreate, UserUpdate
from app.repositories.user_repository import UserRepository
from app.services.base_service import BaseService

logger = logging.getLogger(__name__)


class UserNotFoundException(NotFoundException):
    message = "Пользователь не найден"


class EmailAlreadyExistsException(ConflictException):
    message = "Пользователь с таким email уже существует"


class UserService(BaseService):
    """Сервис для работы с пользователями."""

    user_repository: UserRepository

    async def get_user_by_id(self, user_id: int) -> User:
        """Получение пользователя по ID."""
        user = await self.user_repository.get_by_id(user_id)
        if not user:
            raise UserNotFoundException(details={"user_id": user_id})
        return user

    async def get_user_by_email(self, email: str) -> User:
        """Получение пользователя по email."""
        user = await self.user_repository.get_by_email(email)
        if not user:
            raise UserNotFoundException(details={"email": email})
        return user

    async def create_user(self, data: UserCreate) -> User:
        """Создание нового пользователя."""
        logger.debug(f"Creating user with email: {data.email}")

        existing = await self.user_repository.get_by_email(data.email)
        if existing:
            logger.warning(f"Email already exists: {data.email}")
            raise EmailAlreadyExistsException(details={"email": data.email})

        user_data = data.model_dump()
        user_data["hashed_password"] = hash_password(user_data.pop("password"))

        user = await self.user_repository.create(user_data)
        logger.info(f"User created: id={user.id}, email={user.email}")

        return user

    async def update_user(self, user_id: int, data: UserUpdate) -> User:
        """Обновление данных пользователя."""
        user = await self.get_user_by_id(user_id)

        if data.email and data.email != user.email:
            existing = await self.user_repository.get_by_email(data.email)
            if existing:
                raise EmailAlreadyExistsException(details={"email": data.email})

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

