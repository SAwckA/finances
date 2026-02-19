from datetime import date
from typing import Sequence

from app.models.recurring_transaction import RecurringTransaction
from app.repositories.base_repository import BaseRepository


class RecurringTransactionRepository(BaseRepository[RecurringTransaction]):
    """Репозиторий для работы с периодическими транзакциями."""

    async def get_by_workspace_id(
        self,
        workspace_id: int,
        is_active: bool | None = None,
        skip: int = 0,
        limit: int = 100,
    ) -> Sequence[RecurringTransaction]:
        """Получить периодические транзакции рабочего пространства."""
        query = self._base_query().where(
            RecurringTransaction.workspace_id == workspace_id
        )
        if is_active is not None:
            query = query.where(RecurringTransaction.is_active == is_active)
        query = (
            query.order_by(RecurringTransaction.next_execution_date)
            .offset(skip)
            .limit(limit)
        )
        result = await self.session.execute(query)
        return result.scalars().all()

    async def get_workspace_recurring(
        self,
        workspace_id: int,
        recurring_id: int,
    ) -> RecurringTransaction | None:
        """Получить конкретную периодическую транзакцию рабочего пространства."""
        return await self.get_by(workspace_id=workspace_id, id=recurring_id)

    async def get_pending(self, as_of_date: date) -> Sequence[RecurringTransaction]:
        """
        Получить периодические транзакции, готовые к выполнению.

        Args:
            as_of_date: Дата, на которую проверяем (обычно сегодня)

        Returns:
            Список транзакций, у которых next_execution_date <= as_of_date
        """
        query = (
            self._base_query()
            .where(RecurringTransaction.is_active.is_(True))
            .where(RecurringTransaction.next_execution_date <= as_of_date)
        )
        result = await self.session.execute(query)
        return result.scalars().all()

    async def get_pending_for_workspace(
        self,
        workspace_id: int,
        as_of_date: date,
    ) -> Sequence[RecurringTransaction]:
        """Получить ожидающие выполнения транзакции рабочего пространства."""
        query = (
            self._base_query()
            .where(RecurringTransaction.workspace_id == workspace_id)
            .where(RecurringTransaction.is_active.is_(True))
            .where(RecurringTransaction.next_execution_date <= as_of_date)
        )
        result = await self.session.execute(query)
        return result.scalars().all()

    async def get_pending_global(
        self, as_of_date: date
    ) -> Sequence[RecurringTransaction]:
        """Получить ожидающие выполнения транзакции всех рабочих пространств."""
        query = (
            self._base_query()
            .where(RecurringTransaction.is_active.is_(True))
            .where(RecurringTransaction.next_execution_date <= as_of_date)
            .order_by(
                RecurringTransaction.workspace_id,
                RecurringTransaction.next_execution_date,
                RecurringTransaction.id,
            )
        )
        result = await self.session.execute(query)
        return result.scalars().all()
