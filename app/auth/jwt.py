import logging
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt

from app.config.env import settings
from app.exceptions import AuthException

logger = logging.getLogger(__name__)


class InvalidTokenException(AuthException):
    message = "Недействительный токен"


class TokenExpiredException(AuthException):
    message = "Срок действия токена истёк"


@dataclass
class TokenPayload:
    """Структура payload токена."""

    user_id: int
    exp: datetime
    token_type: str = "access"


def create_access_token(user_id: int) -> str:
    """Создание access токена."""
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.jwt_access_token_expire_minutes
    )
    payload = {
        "sub": str(user_id),
        "exp": expire,
        "type": "access",
    }
    return jwt.encode(
        payload,
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )


def create_refresh_token(user_id: int) -> str:
    """Создание refresh токена."""
    expire = datetime.now(timezone.utc) + timedelta(
        days=settings.jwt_refresh_token_expire_days
    )
    payload = {
        "sub": str(user_id),
        "exp": expire,
        "type": "refresh",
    }
    return jwt.encode(
        payload,
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )


def decode_token(token: str, expected_type: str = "access") -> TokenPayload:
    """Декодирование и валидация токена."""
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
        )

        user_id = int(payload.get("sub"))
        exp = datetime.fromtimestamp(payload.get("exp"), tz=timezone.utc)
        token_type = payload.get("type", "access")

        if token_type != expected_type:
            raise InvalidTokenException(
                message=f"Ожидался {expected_type} токен",
                details={"received_type": token_type},
            )

        return TokenPayload(user_id=user_id, exp=exp, token_type=token_type)

    except jwt.ExpiredSignatureError:
        logger.debug("Token expired")
        raise TokenExpiredException()
    except JWTError as e:
        logger.warning(f"Invalid token: {e}")
        raise InvalidTokenException()

