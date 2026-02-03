from app.models.user import User
from app.repositories.base_repository import BaseRepository


class UserRepository(BaseRepository[User]):
    """Репозиторий для работы с пользователями."""

    async def get_by_email(self, email: str) -> User | None:
        """Получение пользователя по email."""
        return await self.get_by(email=email)

    async def get_active_users(self, skip: int = 0, limit: int = 100):
        """Получение списка активных пользователей."""
        return await self.get_many_by(skip=skip, limit=limit, is_active=True)
