from contextlib import asynccontextmanager
import logging

import uvicorn
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware

from app.api.exception_handlers import (
    app_exception_handler,
    unhandled_exception_handler,
)
from app.api.controllers.google_oauth import router as google_oauth_router
from app.api.router import router
from app.config.env import settings
from app.config.logging import setup_logging
from app.exceptions import AppException

setup_logging()

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Application started")
    yield
    logger.info("Application stopped")


app = FastAPI(
    title="Finance API",
    version="0.1.0",
    debug=settings.debug,
    lifespan=lifespan,
)


@app.exception_handler(AppException)
async def handle_app_exception(request: Request, exc: AppException) -> Response:
    return await app_exception_handler(request, exc)


@app.exception_handler(Exception)
async def handle_exception(request: Request, exc: Exception) -> Response:
    return await unhandled_exception_handler(request, exc)


app.include_router(router)
app.include_router(google_oauth_router)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check():
    """Проверка работоспособности сервиса."""
    return {"status": "ok"}


uvicorn.run(
    app,
    port=8000,
    host="0.0.0.0",
    log_config=None,
    access_log=True,
)
