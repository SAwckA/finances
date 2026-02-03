import logging

from fastapi import Request
from fastapi.responses import JSONResponse

from app.exceptions import AppException

logger = logging.getLogger(__name__)


async def app_exception_handler(
    request: Request,
    exc: AppException,
) -> JSONResponse:
    """Обработчик кастомных исключений приложения."""
    if exc.status_code >= 500:
        logger.error(
            f"Server error: {exc.message}",
            extra={"details": exc.details, "path": request.url.path},
        )
    else:
        logger.warning(
            f"Client error: {exc.message}",
            extra={"details": exc.details, "path": request.url.path},
        )

    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "message": exc.message,
                "details": exc.details,
                "type": exc.__class__.__name__,
            }
        },
    )


async def unhandled_exception_handler(
    request: Request,
    exc: Exception,
) -> JSONResponse:
    """Обработчик непредвиденных исключений."""
    logger.exception(
        f"Unhandled exception: {exc}",
        extra={"path": request.url.path},
    )

    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "message": "Внутренняя ошибка сервера",
                "type": "InternalServerError",
            }
        },
    )
