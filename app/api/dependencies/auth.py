import logging

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.auth.jwt import InvalidTokenException, decode_token
from app.exceptions import ForbiddenException
from app.models.user import User
from app.services.user_service import UserService

logger = logging.getLogger(__name__)

bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user_optional(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> User | None:
    """Получение текущего пользователя (опционально)."""
    if not credentials:
        return None

    try:
        payload = decode_token(credentials.credentials)
        async with UserService() as service:
            return await service.get_user_by_id(payload.user_id)
    except Exception:
        return None


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> User:
    """Получение текущего пользователя (обязательно)."""
    if not credentials:
        raise InvalidTokenException(message="Требуется аутентификация")

    payload = decode_token(credentials.credentials)

    async with UserService() as service:
        return await service.get_user_by_id(payload.user_id)


async def get_current_active_user(
    user: User = Depends(get_current_user),
) -> User:
    """Получение активного пользователя."""
    if not user.is_active:
        raise ForbiddenException(message="Аккаунт деактивирован")
    return user

