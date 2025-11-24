from typing import Any


class AppException(Exception):
    """Базовое исключение приложения."""

    message: str = "Произошла ошибка"
    status_code: int = 500

    def __init__(
        self,
        message: str | None = None,
        details: Any = None,
    ) -> None:
        self.message = message or self.message
        self.details = details
        super().__init__(self.message)


class NotFoundException(AppException):
    """Ресурс не найден."""

    message = "Ресурс не найден"
    status_code = 404


class ValidationException(AppException):
    """Ошибка валидации данных."""

    message = "Ошибка валидации данных"
    status_code = 400


class ConflictException(AppException):
    """Конфликт данных (дубликаты и т.д.)."""

    message = "Конфликт данных"
    status_code = 409


class AuthException(AppException):
    """Ошибка аутентификации."""

    message = "Ошибка аутентификации"
    status_code = 401


class ForbiddenException(AppException):
    """Доступ запрещён."""

    message = "Доступ запрещён"
    status_code = 403


class BusinessLogicException(AppException):
    """Ошибка бизнес-логики."""

    message = "Операция невозможна"
    status_code = 422

