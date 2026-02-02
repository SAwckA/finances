import contextvars
from types import TracebackType
from typing import Any, Self, get_type_hints

from sqlalchemy.ext.asyncio import AsyncSession

from app.config.database import SessionLocal, _current_session


class BaseService:
    """
    Базовый класс для всех сервисов.

    Особенности:
    - Автоматическая инициализация зависимостей через аннотации типов
    - Поддержка инжекта зависимостей через kwargs
    - Context manager для автоматической очистки ресурсов
    - Множественные зависимости (репозитории, другие сервисы)
    """

    _session: AsyncSession | None = None
    _owns_session: bool = False
    _token: contextvars.Token[AsyncSession | None] | None = None
    _created_dependencies: list[Any]

    def __init__(self, **kwargs: Any) -> None:
        self._created_dependencies = []

        if "session" in kwargs:
            session = kwargs.pop("session")
            if isinstance(session, AsyncSession):
                self._session = session

        hints = get_type_hints(self.__class__)
        for name, hint_type in hints.items():
            if name.startswith("_"):
                continue

            if name in kwargs:
                setattr(self, name, kwargs[name])
            elif not hasattr(self, name) or getattr(self, name) is None:
                instance = hint_type()
                self._created_dependencies.append(instance)
                setattr(self, name, instance)

    async def __aenter__(self) -> Self:
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
