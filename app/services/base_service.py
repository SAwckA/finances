import contextvars
from types import TracebackType
from typing import get_type_hints

from sqlalchemy.ext.asyncio import AsyncSession

from app.config.database import SessionLocal, _current_session
from app.repositories.base_repository import BaseRepository


class BaseService:
    """
    Базовый класс для всех сервисов.

    Особенности:
    - Ленивая инициализация зависимостей через аннотации типов
    - Поддержка инжекта зависимостей через kwargs
    - Context manager для автоматической очистки ресурсов
    - Множественные зависимости (репозитории, другие сервисы)
    """

    _session: AsyncSession | None = None
    _owns_session: bool = False
    _token: contextvars.Token | None = None

    def __init__(self, **kwargs: object) -> None:
        self._injected_dependencies = kwargs
        self._created_dependencies: list = []

        if "session" in kwargs:
            self._session = kwargs.pop("session")

    def __getattr__(self, name: str) -> object:
        if name.startswith("_"):
            raise AttributeError(f"'{self.__class__.__name__}' has no attribute '{name}'")

        if name in self._injected_dependencies:
            return self._injected_dependencies[name]

        hints = get_type_hints(self.__class__)
        if name in hints:
            dependency_class = hints[name]
            instance = dependency_class()
            self._created_dependencies.append(instance)
            setattr(self, name, instance)
            return instance

        raise AttributeError(f"'{self.__class__.__name__}' has no attribute '{name}'")

    async def __aenter__(self) -> "BaseService":
        if self._session is None:
            self._session = SessionLocal()
            self._owns_session = True

        self._token = _current_session.set(self._session)
        return self

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc_val: BaseException | None,
        exc_tb: TracebackType | None,
    ) -> None:
        if self._token:
            _current_session.reset(self._token)

        if self._owns_session and self._session:
            if exc_type:
                await self._session.rollback()
            else:
                await self._session.commit()
            await self._session.close()
            self._session = None
            self._owns_session = False

    async def commit(self) -> None:
        if self._session:
            await self._session.commit()

    async def rollback(self) -> None:
        if self._session:
            await self._session.rollback()

