import logging
from dataclasses import dataclass

from app.auth.jwt import (
    create_access_token,
    create_refresh_token,
    decode_token,
)
from app.auth.password import hash_password, verify_password
from app.exceptions import AuthException, ConflictException
from app.models.user import User, UserCreate, UserResponse
from app.repositories.user_repository import UserRepository
from app.services.base_service import BaseService

logger = logging.getLogger(__name__)


class InvalidCredentialsException(AuthException):
    message = "Неверный email или пароль"


class EmailAlreadyExistsException(ConflictException):
    message = "Пользователь с таким email уже существует"


@dataclass
class TokenResponse:
    """Структура ответа с токенами."""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class AuthService(BaseService):
    """Сервис аутентификации."""

    user_repository: UserRepository

    async def register(self, data: UserCreate) -> UserResponse:
        """Регистрация нового пользователя."""
        logger.info(f"Registration attempt for email: {data.email}")

        existing = await self.user_repository.get_by_email(data.email)
        if existing:
            logger.warning(f"Registration failed - email exists: {data.email}")
            raise EmailAlreadyExistsException()

        user_data = data.model_dump()
        user_data["hashed_password"] = hash_password(user_data.pop("password"))

        user = await self.user_repository.create(user_data)
        logger.info(f"User registered successfully: {user.id}")

        return UserResponse.model_validate(user)

    async def login(self, email: str, password: str) -> TokenResponse:
        """Аутентификация и получение токенов."""
        logger.info(f"Login attempt for email: {email}")

        user = await self.user_repository.get_by_email(email)

        if not user or not verify_password(password, user.hashed_password):
            logger.warning(f"Login failed for email: {email}")
            raise InvalidCredentialsException()

        if not user.is_active:
            logger.warning(f"Login attempt for inactive user: {user.id}")
            raise InvalidCredentialsException(message="Аккаунт деактивирован")

        logger.info(f"User logged in: {user.id}")

        return TokenResponse(
            access_token=create_access_token(user.id),
            refresh_token=create_refresh_token(user.id),
        )

    async def refresh_tokens(self, refresh_token: str) -> TokenResponse:
        """Обновление токенов по refresh token."""
        payload = decode_token(refresh_token, expected_type="refresh")

        user = await self.user_repository.get_by_id(payload.user_id)
        if not user or not user.is_active:
            raise InvalidCredentialsException()

        logger.info(f"Tokens refreshed for user: {user.id}")

        return TokenResponse(
            access_token=create_access_token(user.id),
            refresh_token=create_refresh_token(user.id),
        )

