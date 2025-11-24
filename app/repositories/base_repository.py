from datetime import datetime, timezone
from typing import Generic, Sequence, TypeVar

from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config.database import _current_session
from app.models.base import Base, SoftDeleteMixin

ModelType = TypeVar("ModelType", bound=Base)


class BaseRepository(Generic[ModelType]):
    """
    Базовый репозиторий с CRUD операциями.
    Автоматически поддерживает soft delete если модель наследует SoftDeleteMixin.
    """

    model: type[ModelType]

    def __init__(self, session: AsyncSession | None = None) -> None:
        self._explicit_session = session

    def __init_subclass__(cls, **kwargs: object) -> None:
        super().__init_subclass__(**kwargs)
        for base in getattr(cls, "__orig_bases__", []):
            if hasattr(base, "__args__"):
                cls.model = base.__args__[0]
                break

    @property
    def session(self) -> AsyncSession:
        if self._explicit_session:
            return self._explicit_session

        ctx_session = _current_session.get()
        if ctx_session:
            return ctx_session

        raise RuntimeError("No session available")

    @property
    def _supports_soft_delete(self) -> bool:
        return issubclass(self.model, SoftDeleteMixin)

    def _base_query(self, include_deleted: bool = False):
        query = select(self.model)

        if self._supports_soft_delete and not include_deleted:
            query = query.where(self.model.deleted_at.is_(None))

        return query

    async def create(self, data: dict) -> ModelType:
        instance = self.model(**data)
        self.session.add(instance)
        await self.session.flush()
        await self.session.refresh(instance)
        return instance

    async def get_by_id(
        self,
        id: int,
        include_deleted: bool = False,
    ) -> ModelType | None:
        query = self._base_query(include_deleted).where(self.model.id == id)
        result = await self.session.execute(query)
        return result.scalar_one_or_none()

    async def get_all(
        self,
        skip: int = 0,
        limit: int = 100,
        include_deleted: bool = False,
    ) -> Sequence[ModelType]:
        query = self._base_query(include_deleted).offset(skip).limit(limit)
        result = await self.session.execute(query)
        return result.scalars().all()

    async def get_by(
        self,
        include_deleted: bool = False,
        **filters: object,
    ) -> ModelType | None:
        query = self._base_query(include_deleted).filter_by(**filters)
        result = await self.session.execute(query)
        return result.scalar_one_or_none()

    async def get_many_by(
        self,
        skip: int = 0,
        limit: int = 100,
        include_deleted: bool = False,
        **filters: object,
    ) -> Sequence[ModelType]:
        query = (
            self._base_query(include_deleted)
            .filter_by(**filters)
            .offset(skip)
            .limit(limit)
        )
        result = await self.session.execute(query)
        return result.scalars().all()

    async def update(self, id: int, data: dict) -> ModelType | None:
        update_data = {k: v for k, v in data.items() if v is not None}

        if not update_data:
            return await self.get_by_id(id)

        query = (
            update(self.model)
            .where(self.model.id == id)
            .values(**update_data)
            .returning(self.model)
        )

        if self._supports_soft_delete:
            query = query.where(self.model.deleted_at.is_(None))

        result = await self.session.execute(query)
        await self.session.flush()
        return result.scalar_one_or_none()

    async def delete(self, id: int) -> bool:
        if self._supports_soft_delete:
            return await self.soft_delete(id)
        return await self.hard_delete(id)

    async def soft_delete(self, id: int) -> bool:
        if not self._supports_soft_delete:
            raise TypeError(f"{self.model.__name__} does not support soft delete")

        query = (
            update(self.model)
            .where(self.model.id == id)
            .where(self.model.deleted_at.is_(None))
            .values(deleted_at=datetime.now(timezone.utc))
        )
        result = await self.session.execute(query)
        return result.rowcount > 0

    async def hard_delete(self, id: int) -> bool:
        query = delete(self.model).where(self.model.id == id)
        result = await self.session.execute(query)
        return result.rowcount > 0

    async def restore(self, id: int) -> ModelType | None:
        if not self._supports_soft_delete:
            raise TypeError(f"{self.model.__name__} does not support soft delete")

        query = (
            update(self.model)
            .where(self.model.id == id)
            .where(self.model.deleted_at.is_not(None))
            .values(deleted_at=None)
            .returning(self.model)
        )
        result = await self.session.execute(query)
        await self.session.flush()
        return result.scalar_one_or_none()

    async def exists(self, id: int, include_deleted: bool = False) -> bool:
        instance = await self.get_by_id(id, include_deleted=include_deleted)
        return instance is not None

    async def count(self, include_deleted: bool = False) -> int:
        query = select(func.count()).select_from(self.model)
        if self._supports_soft_delete and not include_deleted:
            query = query.where(self.model.deleted_at.is_(None))
        result = await self.session.execute(query)
        return result.scalar_one()

    async def get_deleted(
        self,
        skip: int = 0,
        limit: int = 100,
    ) -> Sequence[ModelType]:
        if not self._supports_soft_delete:
            return []

        query = (
            select(self.model)
            .where(self.model.deleted_at.is_not(None))
            .offset(skip)
            .limit(limit)
        )
        result = await self.session.execute(query)
        return result.scalars().all()
