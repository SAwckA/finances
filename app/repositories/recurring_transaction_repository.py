from datetime import date
from typing import Sequence

from app.models.recurring_transaction import RecurringTransaction
from app.repositories.base_repository import BaseRepository


class RecurringTransactionRepository(BaseRepository[RecurringTransaction]):
    """Репозиторий для работы с периодическими транзакциями."""

    async def get_by_user_id(
        self,
        user_id: int,
        is_active: bool | None = None,
        skip: int = 0,
        limit: int = 100,
    ) -> Sequence[RecurringTransaction]:
        """Получить периодические транзакции пользователя."""
        query = self._base_query().where(RecurringTransaction.user_id == user_id)
        if is_active is not None:
            query = query.where(RecurringTransaction.is_active == is_active)
        query = (
            query.order_by(RecurringTransaction.next_execution_date)
            .offset(skip)
            .limit(limit)
        )
        result = await self.session.execute(query)
        return result.scalars().all()

    async def get_user_recurring(
        self, user_id: int, recurring_id: int
    ) -> RecurringTransaction | None:
        """Получить конкретную периодическую транзакцию пользователя."""
        return await self.get_by(user_id=user_id, id=recurring_id)

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

    async def get_pending_for_user(
        self, user_id: int, as_of_date: date
    ) -> Sequence[RecurringTransaction]:
        """Получить ожидающие выполнения транзакции пользователя."""
        query = (
            self._base_query()
            .where(RecurringTransaction.user_id == user_id)
            .where(RecurringTransaction.is_active.is_(True))
            .where(RecurringTransaction.next_execution_date <= as_of_date)
        )
        result = await self.session.execute(query)
        return result.scalars().all()
