import hashlib
import logging
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from authlib.integrations.httpx_client import AsyncOAuth2Client
from jose import JWTError
from jose import jwt as jose_jwt
from jose.exceptions import ExpiredSignatureError

from app.auth.jwt import create_access_token, create_refresh_token, decode_token
from app.config.env import settings
from app.exceptions import AuthException, ConflictException
from app.repositories.auth_exchange_code_repository import AuthExchangeCodeRepository
from app.repositories.user_repository import UserRepository
from app.services.base_service import BaseService

logger = logging.getLogger(__name__)

GOOGLE_AUTHORIZATION_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_ENDPOINT = "https://openidconnect.googleapis.com/v1/userinfo"
GOOGLE_SCOPES = "openid email profile"


class InvalidCredentialsException(AuthException):
    message = "Неверные учетные данные"


class InvalidGoogleStateException(AuthException):
    message = "Недействительный state параметр OAuth"


class GoogleAuthExchangeException(AuthException):
    message = "Ошибка обмена OAuth кода Google"


class InvalidAuthCodeException(AuthException):
    message = "Недействительный или просроченный auth_code"


class GoogleAccountAlreadyLinkedException(ConflictException):
    message = "Email уже связан с другим Google аккаунтом"


@dataclass
class TokenResponse:
    """Структура ответа с токенами."""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"


@dataclass
class GoogleUserInfo:
    """Нормализованное представление профиля Google пользователя."""

    sub: str
    email: str
    email_verified: bool
    name: str
    picture: str | None


class AuthService(BaseService):
    """Сервис аутентификации через Google OAuth."""

    user_repository: UserRepository
    auth_exchange_code_repository: AuthExchangeCodeRepository

    async def build_google_authorization_url(self) -> str:
        """Формирует URL для старта авторизации через Google."""
        state = self._create_google_state()

        async with AsyncOAuth2Client(
            client_id=settings.google_client_id,
            client_secret=settings.google_client_secret,
            scope=GOOGLE_SCOPES,
            redirect_uri=settings.google_redirect_uri,
        ) as client:
            authorization_url, _ = client.create_authorization_url(
                GOOGLE_AUTHORIZATION_ENDPOINT,
                state=state,
                access_type="offline",
                include_granted_scopes="true",
                prompt="select_account",
            )
        return authorization_url

    async def finish_google_oauth(self, code: str, state: str) -> str:
        """Обрабатывает callback Google и создает одноразовый auth_code."""
        self._validate_google_state(state)
        profile = await self._fetch_google_profile(code)

        async with self.user_repository.session.begin_nested():
            user = await self._find_or_create_google_user(profile)
            auth_code = await self._issue_auth_exchange_code(user.id)

        return auth_code

    async def exchange_google_auth_code(self, auth_code: str) -> TokenResponse:
        """Обменивает одноразовый auth_code на JWT токены приложения."""
        code_hash = self._hash_auth_code(auth_code)
        exchange_code = await self.auth_exchange_code_repository.consume_valid_code(
            code_hash
        )

        if not exchange_code:
            raise InvalidAuthCodeException()

        user = await self.user_repository.get_by_id(exchange_code.user_id)
        if not user or not user.is_active:
            raise InvalidCredentialsException(message="Аккаунт деактивирован")

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

    async def _fetch_google_profile(self, code: str) -> GoogleUserInfo:
        """Обменивает authorization code на userinfo Google."""
        try:
            async with AsyncOAuth2Client(
                client_id=settings.google_client_id,
                client_secret=settings.google_client_secret,
                redirect_uri=settings.google_redirect_uri,
            ) as client:
                token = await client.fetch_token(
                    GOOGLE_TOKEN_ENDPOINT,
                    grant_type="authorization_code",
                    code=code,
                )
                access_token = token.get("access_token")
                if not access_token:
                    raise GoogleAuthExchangeException(
                        message="Google не вернул access_token",
                    )

                profile_response = await client.get(
                    GOOGLE_USERINFO_ENDPOINT,
                    headers={"Authorization": f"Bearer {access_token}"},
                )
                profile_response.raise_for_status()
        except Exception as exc:
            logger.warning("Google OAuth exchange failed: %s", exc)
            raise GoogleAuthExchangeException() from exc

        payload = profile_response.json()
        sub = payload.get("sub")
        email = payload.get("email")

        if not sub or not email:
            raise GoogleAuthExchangeException(
                message="Google не вернул обязательные поля"
            )

        return GoogleUserInfo(
            sub=sub,
            email=email.lower(),
            email_verified=bool(payload.get("email_verified", False)),
            name=(payload.get("name") or email.split("@")[0]).strip(),
            picture=payload.get("picture"),
        )

    async def _find_or_create_google_user(self, profile: GoogleUserInfo):
        """Ищет/создает пользователя и связывает его с Google аккаунтом."""
        user = await self.user_repository.get_by_google_sub(profile.sub)

        if user:
            if not user.is_active:
                raise InvalidCredentialsException(message="Аккаунт деактивирован")

            updates = {
                "name": profile.name,
                "avatar_url": profile.picture,
                "auth_provider": "google",
            }
            updated = await self.user_repository.update(user.id, updates)
            return updated or user

        existing_by_email = await self.user_repository.get_by_email(profile.email)

        if not profile.email_verified and not existing_by_email:
            raise GoogleAuthExchangeException(
                message="Google email не подтвержден, создание нового аккаунта запрещено",
            )

        if existing_by_email:
            if (
                existing_by_email.google_sub
                and existing_by_email.google_sub != profile.sub
            ):
                raise GoogleAccountAlreadyLinkedException()

            updates = {
                "google_sub": profile.sub,
                "auth_provider": "google",
                "name": profile.name,
                "avatar_url": profile.picture,
            }
            updated = await self.user_repository.update(existing_by_email.id, updates)
            if not existing_by_email.is_active:
                raise InvalidCredentialsException(message="Аккаунт деактивирован")
            return updated or existing_by_email

        user = await self.user_repository.create(
            {
                "email": profile.email,
                "name": profile.name,
                "hashed_password": None,
                "auth_provider": "google",
                "google_sub": profile.sub,
                "avatar_url": profile.picture,
                "is_active": True,
            }
        )
        logger.info("Google user created: id=%s", user.id)
        return user

    async def _issue_auth_exchange_code(self, user_id: int) -> str:
        """Создает одноразовый auth_code и сохраняет только его hash."""
        raw_code = secrets.token_urlsafe(48)
        expires_at = datetime.now(timezone.utc) + timedelta(
            seconds=settings.auth_exchange_code_ttl_seconds
        )

        await self.auth_exchange_code_repository.create(
            {
                "user_id": user_id,
                "code_hash": self._hash_auth_code(raw_code),
                "expires_at": expires_at,
                "used_at": None,
            }
        )

        return raw_code

    def _create_google_state(self) -> str:
        """Создает короткоживущий подписанный state для OAuth callback."""
        expires_at = datetime.now(timezone.utc) + timedelta(
            seconds=settings.google_oauth_state_expire_seconds
        )
        payload = {
            "type": "google_oauth_state",
            "exp": expires_at,
            "nonce": secrets.token_urlsafe(24),
        }
        return jose_jwt.encode(
            payload,
            settings.jwt_secret_key,
            algorithm=settings.jwt_algorithm,
        )

    def _validate_google_state(self, state: str) -> None:
        """Проверяет подпись и срок действия state."""
        try:
            payload = jose_jwt.decode(
                state,
                settings.jwt_secret_key,
                algorithms=[settings.jwt_algorithm],
            )
        except ExpiredSignatureError as exc:
            raise InvalidGoogleStateException(message="State параметр истек") from exc
        except JWTError as exc:
            raise InvalidGoogleStateException() from exc

        if payload.get("type") != "google_oauth_state":
            raise InvalidGoogleStateException()

    @staticmethod
    def _hash_auth_code(raw_code: str) -> str:
        return hashlib.sha256(raw_code.encode("utf-8")).hexdigest()
