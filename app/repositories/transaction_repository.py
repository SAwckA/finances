from datetime import datetime
from decimal import Decimal
from typing import Sequence

from sqlalchemy import func, select

from app.models.transaction import Transaction, TransactionType
from app.repositories.base_repository import BaseRepository


class TransactionRepository(BaseRepository[Transaction]):
    """Репозиторий для работы с транзакциями."""

    async def get_by_workspace_id(
        self,
        workspace_id: int,
        skip: int = 0,
        limit: int = 100,
    ) -> Sequence[Transaction]:
        """Получить все транзакции рабочего пространства."""
        return await self.get_many_by(
            workspace_id=workspace_id,
            skip=skip,
            limit=limit,
        )

    async def get_by_account_id(
        self,
        workspace_id: int,
        account_id: int,
        skip: int = 0,
        limit: int = 100,
    ) -> Sequence[Transaction]:
        """Получить транзакции по счёту."""
        query = (
            self._base_query()
            .where(Transaction.workspace_id == workspace_id)
            .where(
                (Transaction.account_id == account_id)
                | (Transaction.target_account_id == account_id)
            )
            .order_by(Transaction.transaction_date.desc())
            .offset(skip)
            .limit(limit)
        )
        result = await self.session.execute(query)
        return result.scalars().all()

    async def get_by_date_range(
        self,
        workspace_id: int,
        start_date: datetime,
        end_date: datetime,
        transaction_type: TransactionType | None = None,
    ) -> Sequence[Transaction]:
        """Получить транзакции за период."""
        query = (
            self._base_query()
            .where(Transaction.workspace_id == workspace_id)
            .where(Transaction.transaction_date >= start_date)
            .where(Transaction.transaction_date <= end_date)
        )
        if transaction_type:
            query = query.where(Transaction.type == transaction_type)
        query = query.order_by(Transaction.transaction_date.desc())
        result = await self.session.execute(query)
        return result.scalars().all()

    async def get_account_balance(self, workspace_id: int, account_id: int) -> Decimal:
        """Вычислить баланс счёта на основе транзакций."""
        income_query = (
            select(func.coalesce(func.sum(Transaction.amount), 0))
            .where(Transaction.deleted_at.is_(None))
            .where(Transaction.workspace_id == workspace_id)
            .where(Transaction.account_id == account_id)
            .where(Transaction.type == TransactionType.INCOME)
        )

        expense_query = (
            select(func.coalesce(func.sum(Transaction.amount), 0))
            .where(Transaction.deleted_at.is_(None))
            .where(Transaction.workspace_id == workspace_id)
            .where(Transaction.account_id == account_id)
            .where(Transaction.type == TransactionType.EXPENSE)
        )

        transfer_out_query = (
            select(func.coalesce(func.sum(Transaction.amount), 0))
            .where(Transaction.deleted_at.is_(None))
            .where(Transaction.workspace_id == workspace_id)
            .where(Transaction.account_id == account_id)
            .where(Transaction.type == TransactionType.TRANSFER)
        )

        transfer_in_query = (
            select(func.coalesce(func.sum(Transaction.converted_amount), 0))
            .where(Transaction.deleted_at.is_(None))
            .where(Transaction.workspace_id == workspace_id)
            .where(Transaction.target_account_id == account_id)
            .where(Transaction.type == TransactionType.TRANSFER)
        )

        income_result = await self.session.execute(income_query)
        expense_result = await self.session.execute(expense_query)
        transfer_out_result = await self.session.execute(transfer_out_query)
        transfer_in_result = await self.session.execute(transfer_in_query)

        income = income_result.scalar() or Decimal("0")
        expense = expense_result.scalar() or Decimal("0")
        transfer_out = transfer_out_result.scalar() or Decimal("0")
        transfer_in = transfer_in_result.scalar() or Decimal("0")

        return income - expense - transfer_out + transfer_in

    async def get_sum_by_category(
        self,
        workspace_id: int,
        start_date: datetime,
        end_date: datetime,
        transaction_type: TransactionType,
        account_ids: Sequence[int] | None = None,
    ) -> Sequence[tuple[int | None, Decimal]]:
        """Получить суммы по категориям за период."""
        query = (
            select(Transaction.category_id, func.sum(Transaction.amount))
            .where(Transaction.deleted_at.is_(None))
            .where(Transaction.workspace_id == workspace_id)
            .where(Transaction.type == transaction_type)
            .where(Transaction.transaction_date >= start_date)
            .where(Transaction.transaction_date <= end_date)
            .where(Transaction.category_id.is_not(None))
            .group_by(Transaction.category_id)
        )
        if account_ids:
            query = query.where(Transaction.account_id.in_(account_ids))
        result = await self.session.execute(query)
        return [(row[0], row[1]) for row in result.all()]

    async def get_sum_by_type(
        self,
        workspace_id: int,
        start_date: datetime,
        end_date: datetime,
        transaction_type: TransactionType,
        account_ids: Sequence[int] | None = None,
    ) -> Decimal:
        """Получить сумму по типу транзакции за период."""
        query = (
            select(func.coalesce(func.sum(Transaction.amount), 0))
            .where(Transaction.deleted_at.is_(None))
            .where(Transaction.workspace_id == workspace_id)
            .where(Transaction.type == transaction_type)
            .where(Transaction.transaction_date >= start_date)
            .where(Transaction.transaction_date <= end_date)
        )
        if account_ids:
            query = query.where(Transaction.account_id.in_(account_ids))
        result = await self.session.execute(query)
        return result.scalar() or Decimal("0")

    async def get_sum_by_type_by_account(
        self,
        workspace_id: int,
        start_date: datetime,
        end_date: datetime,
        transaction_type: TransactionType,
        account_ids: Sequence[int] | None = None,
    ) -> Sequence[tuple[int, Decimal]]:
        """Получить суммы по типу с разбивкой по счетам за период."""
        query = (
            select(
                Transaction.account_id, func.coalesce(func.sum(Transaction.amount), 0)
            )
            .where(Transaction.deleted_at.is_(None))
            .where(Transaction.workspace_id == workspace_id)
            .where(Transaction.type == transaction_type)
            .where(Transaction.transaction_date >= start_date)
            .where(Transaction.transaction_date <= end_date)
            .group_by(Transaction.account_id)
        )
        if account_ids:
            query = query.where(Transaction.account_id.in_(account_ids))
        result = await self.session.execute(query)
        return [(row[0], row[1]) for row in result.all()]
