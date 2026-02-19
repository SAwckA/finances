import logging
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone

from dateutil.relativedelta import relativedelta

from app.exceptions import BusinessLogicException, ForbiddenException, NotFoundException
from app.models.recurring_transaction import (
    RecurringFrequency,
    RecurringTransaction,
    RecurringTransactionCreate,
    RecurringTransactionUpdate,
)
from app.models.transaction import Transaction, TransactionType
from app.repositories.account_repository import AccountRepository
from app.repositories.category_repository import CategoryRepository
from app.repositories.recurring_transaction_repository import (
    RecurringTransactionRepository,
)
from app.repositories.transaction_repository import TransactionRepository
from app.services.base_service import BaseService

logger = logging.getLogger(__name__)


# === EXCEPTIONS ===


class RecurringTransactionNotFoundException(NotFoundException):
    """Периодическая транзакция не найдена."""

    message = "Периодическая транзакция не найдена"


class RecurringTransactionAccessDeniedException(ForbiddenException):
    """Доступ к периодической транзакции запрещён."""

    message = "Доступ к периодической транзакции запрещён"


class AccountNotFoundForRecurringException(NotFoundException):
    """Счёт для периодической транзакции не найден."""

    message = "Указанный счёт не найден"


class CategoryNotFoundForRecurringException(NotFoundException):
    """Категория для периодической транзакции не найдена."""

    message = "Указанная категория не найдена"


class InvalidFrequencyConfigException(BusinessLogicException):
    """Неверная конфигурация периодичности."""

    message = "Неверная конфигурация периодичности"


class TransferNotAllowedForRecurringException(BusinessLogicException):
    """Переводы не поддерживаются для периодических транзакций."""

    message = "Периодические переводы не поддерживаются"


class RecurringTransactionInactiveException(BusinessLogicException):
    """Периодическая транзакция неактивна."""

    message = "Периодическая транзакция неактивна"


class RecurringTransactionExpiredException(BusinessLogicException):
    """Период действия периодической транзакции истёк."""

    message = "Период действия периодической транзакции истёк"


@dataclass
class RecurringExecutionError:
    """Ошибки batch-исполнения recurring."""

    recurring_id: int
    workspace_id: int
    message: str


@dataclass
class RecurringExecutionReport:
    """Отчет о batch-исполнении recurring."""

    as_of_date: date
    processed_templates: int = 0
    successful_executions: int = 0
    failed_executions: int = 0
    errors: list[RecurringExecutionError] = field(default_factory=list)


# === SERVICE ===


class RecurringTransactionService(BaseService):
    """Сервис для работы с периодическими транзакциями."""

    recurring_repository: RecurringTransactionRepository
    transaction_repository: TransactionRepository
    account_repository: AccountRepository
    category_repository: CategoryRepository

    async def get_workspace_recurring_transactions(
        self,
        workspace_id: int,
        is_active: bool | None = None,
        skip: int = 0,
        limit: int = 100,
    ):
        """Получить периодические транзакции рабочего пространства."""
        return await self.recurring_repository.get_by_workspace_id(
            workspace_id=workspace_id,
            is_active=is_active,
            skip=skip,
            limit=limit,
        )

    async def get_by_id(self, recurring_id: int, workspace_id: int):
        """Получить периодическую транзакцию по ID с проверкой доступа."""
        recurring = await self.recurring_repository.get_workspace_recurring(
            workspace_id=workspace_id,
            recurring_id=recurring_id,
        )
        if not recurring:
            raise RecurringTransactionNotFoundException(
                details={"recurring_id": recurring_id}
            )
        return recurring

    async def get_pending(self, workspace_id: int, as_of_date: date | None = None):
        """Получить ожидающие выполнения транзакции рабочего пространства."""
        check_date = as_of_date or date.today()
        return await self.recurring_repository.get_pending_for_workspace(
            workspace_id=workspace_id,
            as_of_date=check_date,
        )

    @classmethod
    async def execute_pending_for_all_users(
        cls, as_of_date: date | None = None
    ) -> RecurringExecutionReport:
        """Выполнить все pending recurring по всем пользователям с бэкфиллом."""
        target_date = as_of_date or datetime.now(timezone.utc).date()
        report = RecurringExecutionReport(as_of_date=target_date)

        async with cls() as service:
            pending_items = await service.recurring_repository.get_pending_global(
                target_date
            )

        report.processed_templates = len(pending_items)

        for item in pending_items:
            try:
                async with cls() as service:
                    executed_count = await service._execute_backfill_for_recurring(
                        recurring_id=item.id,
                        workspace_id=item.workspace_id,
                        as_of_date=target_date,
                    )
                report.successful_executions += executed_count
            except Exception as exc:
                report.failed_executions += 1
                report.errors.append(
                    RecurringExecutionError(
                        recurring_id=item.id,
                        workspace_id=item.workspace_id,
                        message=str(exc),
                    )
                )
                logger.exception(
                    "Failed to execute recurring transaction %s for workspace %s",
                    item.id,
                    item.workspace_id,
                )

        return report

    async def create(
        self,
        workspace_id: int,
        actor_user_id: int,
        data: RecurringTransactionCreate,
    ):
        """Создать периодическую транзакцию."""
        if data.type == TransactionType.TRANSFER:
            raise TransferNotAllowedForRecurringException()

        await self._validate_account(workspace_id, data.account_id)
        await self._validate_category(workspace_id, data.category_id, data.type)
        self._validate_frequency_config(
            data.frequency, data.day_of_week, data.day_of_month
        )

        next_execution = self._calculate_next_execution(
            frequency=data.frequency,
            day_of_week=data.day_of_week,
            day_of_month=data.day_of_month,
            start_date=data.start_date,
        )

        recurring_data = {
            "workspace_id": workspace_id,
            "user_id": actor_user_id,
            "type": data.type,
            "account_id": data.account_id,
            "category_id": data.category_id,
            "amount": data.amount,
            "description": data.description,
            "frequency": data.frequency,
            "day_of_week": data.day_of_week,
            "day_of_month": data.day_of_month,
            "start_date": data.start_date,
            "end_date": data.end_date,
            "next_execution_date": next_execution,
            "is_active": True,
        }

        recurring = await self.recurring_repository.create(recurring_data)
        logger.info(
            "Created recurring transaction %s for workspace %s by user %s",
            recurring.id,
            workspace_id,
            actor_user_id,
        )
        return recurring

    async def update(
        self,
        recurring_id: int,
        workspace_id: int,
        data: RecurringTransactionUpdate,
    ):
        """Обновить периодическую транзакцию."""
        recurring = await self.get_by_id(recurring_id, workspace_id)

        update_data = data.model_dump(exclude_unset=True)

        if "category_id" in update_data:
            await self._validate_category(
                workspace_id,
                update_data["category_id"],
                recurring.type,
            )

        if (
            "frequency" in update_data
            or "day_of_week" in update_data
            or "day_of_month" in update_data
        ):
            freq = update_data.get("frequency", recurring.frequency)
            dow = update_data.get("day_of_week", recurring.day_of_week)
            dom = update_data.get("day_of_month", recurring.day_of_month)
            self._validate_frequency_config(freq, dow, dom)

            next_execution = self._calculate_next_execution(
                frequency=freq,
                day_of_week=dow,
                day_of_month=dom,
                start_date=date.today(),
            )
            update_data["next_execution_date"] = next_execution

        updated = await self.recurring_repository.update(recurring_id, update_data)
        logger.info(f"Updated recurring transaction {recurring_id}")
        return updated

    async def delete(self, recurring_id: int, workspace_id: int) -> bool:
        """Удалить периодическую транзакцию."""
        await self.get_by_id(recurring_id, workspace_id)
        result = await self.recurring_repository.delete(recurring_id)
        logger.info(f"Deleted recurring transaction {recurring_id}")
        return result

    async def deactivate(self, recurring_id: int, workspace_id: int):
        """Деактивировать периодическую транзакцию."""
        await self.get_by_id(recurring_id, workspace_id)
        updated = await self.recurring_repository.update(
            recurring_id, {"is_active": False}
        )
        logger.info(f"Deactivated recurring transaction {recurring_id}")
        return updated

    async def activate(self, recurring_id: int, workspace_id: int):
        """Активировать периодическую транзакцию."""
        recurring = await self.get_by_id(recurring_id, workspace_id)

        if recurring.end_date and recurring.end_date < date.today():
            raise RecurringTransactionExpiredException()

        next_execution = self._calculate_next_execution(
            frequency=recurring.frequency,
            day_of_week=recurring.day_of_week,
            day_of_month=recurring.day_of_month,
            start_date=date.today(),
        )

        updated = await self.recurring_repository.update(
            recurring_id,
            {"is_active": True, "next_execution_date": next_execution},
        )
        logger.info(f"Activated recurring transaction {recurring_id}")
        return updated

    async def execute(self, recurring_id: int, workspace_id: int):
        """
        Выполнить периодическую транзакцию.

        Создаёт реальную транзакцию и обновляет next_execution_date.
        """
        recurring = await self.get_by_id(recurring_id, workspace_id)

        if not recurring.is_active:
            raise RecurringTransactionInactiveException()

        if recurring.end_date and recurring.end_date < date.today():
            await self.recurring_repository.update(recurring_id, {"is_active": False})
            raise RecurringTransactionExpiredException()

        transaction = await self._create_transaction_from_recurring(recurring)

        execution_anchor = max(recurring.next_execution_date, date.today())
        next_execution = self._calculate_next_execution_after(
            current_execution_date=execution_anchor,
            frequency=recurring.frequency,
            day_of_week=recurring.day_of_week,
            day_of_month=recurring.day_of_month,
        )

        is_active = True
        if recurring.end_date and next_execution > recurring.end_date:
            is_active = False

        await self.recurring_repository.update(
            recurring_id,
            {
                "next_execution_date": next_execution,
                "last_executed_at": datetime.now(timezone.utc),
                "is_active": is_active,
            },
        )

        logger.info(
            f"Executed recurring transaction {recurring_id}, "
            f"created transaction {transaction.id}"
        )
        return transaction

    async def _execute_backfill_for_recurring(
        self,
        recurring_id: int,
        workspace_id: int,
        as_of_date: date,
    ) -> int:
        """Выполнить один recurring-шаблон с бэкфиллом до указанной даты."""
        recurring = await self.get_by_id(
            recurring_id=recurring_id,
            workspace_id=workspace_id,
        )
        if not recurring.is_active:
            return 0

        executions = 0
        while recurring.is_active and recurring.next_execution_date <= as_of_date:
            execution_date = recurring.next_execution_date

            if recurring.end_date and execution_date > recurring.end_date:
                recurring = await self._deactivate_recurring(recurring.id)
                break

            await self._create_transaction_from_recurring(recurring)
            next_execution = self._calculate_next_execution_after(
                current_execution_date=execution_date,
                frequency=recurring.frequency,
                day_of_week=recurring.day_of_week,
                day_of_month=recurring.day_of_month,
            )

            update_data: dict[str, object] = {
                "next_execution_date": next_execution,
                "last_executed_at": datetime.now(timezone.utc),
            }

            if recurring.end_date and next_execution > recurring.end_date:
                update_data["is_active"] = False

            updated = await self.recurring_repository.update(recurring.id, update_data)
            if not updated:
                raise RecurringTransactionNotFoundException(
                    details={"recurring_id": recurring.id}
                )
            recurring = updated
            executions += 1

        return executions

    async def _create_transaction_from_recurring(
        self, recurring: RecurringTransaction
    ) -> Transaction:
        """Создать обычную транзакцию из recurring-шаблона."""
        transaction_data = {
            "workspace_id": recurring.workspace_id,
            "user_id": recurring.user_id,
            "type": recurring.type,
            "account_id": recurring.account_id,
            "category_id": recurring.category_id,
            "amount": recurring.amount,
            "description": recurring.description,
            "transaction_date": datetime.now(timezone.utc),
            "recurring_transaction_id": recurring.id,
        }
        return await self.transaction_repository.create(transaction_data)

    async def _deactivate_recurring(self, recurring_id: int) -> RecurringTransaction:
        """Деактивировать recurring и вернуть обновленную модель."""
        updated = await self.recurring_repository.update(
            recurring_id, {"is_active": False}
        )
        if not updated:
            raise RecurringTransactionNotFoundException(
                details={"recurring_id": recurring_id}
            )
        return updated

    async def _validate_account(self, workspace_id: int, account_id: int) -> None:
        """Проверить существование и доступ к счёту."""
        account = await self.account_repository.get_by_id(account_id)
        if not account or account.workspace_id != workspace_id:
            raise AccountNotFoundForRecurringException(
                details={"account_id": account_id}
            )

    async def _validate_category(
        self,
        workspace_id: int,
        category_id: int,
        transaction_type: TransactionType,
    ) -> None:
        """Проверить существование и тип категории."""
        category = await self.category_repository.get_by_id(category_id)
        if not category or category.workspace_id != workspace_id:
            raise CategoryNotFoundForRecurringException(
                details={"category_id": category_id}
            )

        expected_type = (
            "income" if transaction_type == TransactionType.INCOME else "expense"
        )
        if category.type.value != expected_type:
            raise InvalidFrequencyConfigException(
                message="Тип категории не соответствует типу транзакции"
            )

    def _validate_frequency_config(
        self,
        frequency: RecurringFrequency,
        day_of_week: int | None,
        day_of_month: int | None,
    ) -> None:
        """Проверить корректность конфигурации периодичности."""
        if frequency == RecurringFrequency.WEEKLY and day_of_week is None:
            raise InvalidFrequencyConfigException(
                message="Для еженедельной периодичности необходимо указать день недели"
            )
        if frequency == RecurringFrequency.MONTHLY and day_of_month is None:
            raise InvalidFrequencyConfigException(
                message="Для ежемесячной периодичности необходимо указать день месяца"
            )

    def _calculate_next_execution(
        self,
        frequency: RecurringFrequency,
        day_of_week: int | None,
        day_of_month: int | None,
        start_date: date,
    ) -> date:
        """Вычислить следующую дату выполнения."""
        today = date.today()
        result = start_date if start_date >= today else today

        if frequency == RecurringFrequency.DAILY:
            return result

        if frequency == RecurringFrequency.WEEKLY:
            if day_of_week is None:
                return result
            current_dow = result.weekday()
            days_ahead = day_of_week - current_dow
            if days_ahead <= 0:
                days_ahead += 7
            return result + timedelta(days=days_ahead)

        if frequency == RecurringFrequency.MONTHLY:
            if day_of_month is None:
                return result
            target_day = min(day_of_month, 28)
            if result.day > target_day:
                result = result + relativedelta(months=1)
            return result.replace(day=target_day)

        return result

    def _calculate_next_execution_after(
        self,
        current_execution_date: date,
        frequency: RecurringFrequency,
        day_of_week: int | None,
        day_of_month: int | None,
    ) -> date:
        """Вычислить следующую дату выполнения после уже выполненной даты."""
        if frequency == RecurringFrequency.DAILY:
            return current_execution_date + timedelta(days=1)

        if frequency == RecurringFrequency.WEEKLY:
            if day_of_week is None:
                return current_execution_date + timedelta(days=7)
            probe = current_execution_date + timedelta(days=1)
            while probe.weekday() != day_of_week:
                probe += timedelta(days=1)
            return probe

        if frequency == RecurringFrequency.MONTHLY:
            if day_of_month is None:
                return current_execution_date + relativedelta(months=1)
            target_day = min(day_of_month, 28)
            next_month = current_execution_date + relativedelta(months=1)
            return next_month.replace(day=target_day)

        return current_execution_date + timedelta(days=1)
