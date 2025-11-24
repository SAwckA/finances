import logging

from fastapi import FastAPI

from app.api.exception_handlers import (
    app_exception_handler,
    unhandled_exception_handler,
)
from app.api.router import router
from app.config.env import settings
from app.config.logging import setup_logging
from app.exceptions import AppException

setup_logging()

logger = logging.getLogger(__name__)

app = FastAPI(
    title="Finance API",
    version="0.1.0",
    debug=settings.debug,
)

app.add_exception_handler(AppException, app_exception_handler)
app.add_exception_handler(Exception, unhandled_exception_handler)

app.include_router(router)


@app.get("/health")
async def health_check():
    """Проверка работоспособности сервиса."""
    return {"status": "ok"}


@app.on_event("startup")
async def startup():
    logger.info("Application started")


@app.on_event("shutdown")
async def shutdown():
    logger.info("Application stopped")

