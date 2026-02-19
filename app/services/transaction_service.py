import logging
from datetime import datetime
from decimal import Decimal

from app.exceptions import (
    BusinessLogicException,
    ForbiddenException,
    NotFoundException,
    ValidationException,
)
from app.models.transaction import TransactionCreate, TransactionType, TransactionUpdate
from app.repositories.account_repository import AccountRepository
from app.repositories.category_repository import CategoryRepository
from app.repositories.transaction_repository import TransactionRepository
from app.services.base_service import BaseService
from app.services.exchange_rate_service import ExchangeRateService

logger = logging.getLogger(__name__)


class TransactionNotFoundException(NotFoundException):
    """Транзакция не найдена."""

    message = "Транзакция не найдена"


class TransactionAccessDeniedException(ForbiddenException):
    """Доступ к транзакции запрещён."""

    message = "Доступ к транзакции запрещён"


class AccountNotFoundForTransactionException(NotFoundException):
    """Счёт для транзакции не найден."""

    message = "Указанный счёт не найден"


class CategoryNotFoundForTransactionException(NotFoundException):
    """Категория для транзакции не найдена."""

    message = "Указанная категория не найдена"


class TransferRequiresTargetAccountException(ValidationException):
    """Для перевода требуется целевой счёт."""

    message = "Для перевода необходимо указать целевой счёт"


class TransferToSameAccountException(ValidationException):
    """Перевод на тот же счёт невозможен."""

    message = "Невозможно совершить перевод на тот же самый счёт"


class CategoryNotAllowedForTransferException(ValidationException):
    """Категория не допустима для переводов."""

    message = "Для переводов категория не указывается"


class InvalidCategoryTypeException(BusinessLogicException):
    """Неверный тип категории для транзакции."""

    message = "Тип категории не соответствует типу транзакции"


class TransactionService(BaseService):
    """Сервис для работы с транзакциями."""

    transaction_repository: TransactionRepository
    account_repository: AccountRepository
    category_repository: CategoryRepository

    async def get_workspace_transactions(
        self,
        workspace_id: int,
        skip: int = 0,
        limit: int = 100,
    ):
        """Получить транзакции рабочего пространства."""
        return await self.transaction_repository.get_by_workspace_id(
            workspace_id=workspace_id,
            skip=skip,
            limit=limit,
        )

    async def get_account_transactions(
        self,
        workspace_id: int,
        account_id: int,
        skip: int = 0,
        limit: int = 100,
    ):
        """Получить транзакции по счёту."""
        account = await self.account_repository.get_by_id(account_id)
        if not account:
            raise AccountNotFoundForTransactionException(
                details={"account_id": account_id}
            )
        if account.workspace_id != workspace_id:
            raise TransactionAccessDeniedException(details={"account_id": account_id})

        return await self.transaction_repository.get_by_account_id(
            workspace_id=workspace_id,
            account_id=account_id,
            skip=skip,
            limit=limit,
        )

    async def get_transactions_by_period(
        self,
        workspace_id: int,
        start_date: datetime,
        end_date: datetime,
        transaction_type: TransactionType | None = None,
    ):
        """Получить транзакции за период."""
        return await self.transaction_repository.get_by_date_range(
            workspace_id=workspace_id,
            start_date=start_date,
            end_date=end_date,
            transaction_type=transaction_type,
        )

    async def get_by_id(self, transaction_id: int, workspace_id: int):
        """Получить транзакцию по ID с проверкой доступа."""
        transaction = await self.transaction_repository.get_by_id(transaction_id)
        if not transaction:
            raise TransactionNotFoundException(
                details={"transaction_id": transaction_id}
            )
        if transaction.workspace_id != workspace_id:
            raise TransactionAccessDeniedException(
                details={"transaction_id": transaction_id}
            )
        return transaction

    async def create(
        self,
        workspace_id: int,
        actor_user_id: int,
        data: TransactionCreate,
        exchange_rate: Decimal | None = None,
        converted_amount: Decimal | None = None,
    ):
        """Создать новую транзакцию."""
        account = await self.account_repository.get_by_id(data.account_id)
        if not account or account.workspace_id != workspace_id:
            raise AccountNotFoundForTransactionException(
                details={"account_id": data.account_id}
            )

        transaction_data: dict[str, object] = {
            "workspace_id": workspace_id,
            "user_id": actor_user_id,
            "type": data.type,
            "account_id": data.account_id,
            "amount": data.amount,
            "description": data.description,
            "transaction_date": data.transaction_date,
        }

        if data.type == TransactionType.TRANSFER:
            await self._validate_transfer(workspace_id, data)
            transaction_data["target_account_id"] = data.target_account_id

            target_account = None
            if data.target_account_id:
                target_account = await self.account_repository.get_by_id(
                    data.target_account_id
                )

            if converted_amount is not None:
                transaction_data["converted_amount"] = converted_amount
                if exchange_rate is None:
                    exchange_rate = converted_amount / data.amount
                transaction_data["exchange_rate"] = exchange_rate
            elif exchange_rate is not None:
                transaction_data["exchange_rate"] = exchange_rate
                transaction_data["converted_amount"] = data.amount * exchange_rate
            elif (
                target_account and account.currency_code != target_account.currency_code
            ):
                raise ValidationException(
                    message="Для перевода между разными валютами требуется курс обмена"
                )
            else:
                transaction_data["converted_amount"] = data.amount
        else:
            await self._validate_income_expense(workspace_id, data)
            if data.category_id:
                transaction_data["category_id"] = data.category_id

        logger.info(
            "Creating %s transaction for workspace %s by user %s: %s",
            data.type.value,
            workspace_id,
            actor_user_id,
            data.amount,
        )
        return await self.transaction_repository.create(transaction_data)

    async def _validate_transfer(
        self, workspace_id: int, data: TransactionCreate
    ) -> None:
        """Валидация данных для перевода."""
        if not data.target_account_id:
            raise TransferRequiresTargetAccountException()
        if data.account_id == data.target_account_id:
            raise TransferToSameAccountException()
        if data.category_id:
            raise CategoryNotAllowedForTransferException()

        target_account = await self.account_repository.get_by_id(data.target_account_id)
        if not target_account or target_account.workspace_id != workspace_id:
            raise AccountNotFoundForTransactionException(
                details={"target_account_id": data.target_account_id}
            )

    async def _validate_income_expense(
        self,
        workspace_id: int,
        data: TransactionCreate,
    ) -> None:
        """Валидация данных для дохода/расхода."""
        if data.category_id:
            category = await self.category_repository.get_by_id(data.category_id)
            if not category or category.workspace_id != workspace_id:
                raise CategoryNotFoundForTransactionException(
                    details={"category_id": data.category_id}
                )

            expected_type = (
                "income" if data.type == TransactionType.INCOME else "expense"
            )
            if category.type.value != expected_type:
                raise InvalidCategoryTypeException(
                    details={
                        "category_type": category.type.value,
                        "transaction_type": data.type.value,
                    }
                )

    async def update(
        self,
        transaction_id: int,
        workspace_id: int,
        data: TransactionUpdate,
        exchange_rate_override: Decimal | None = None,
        converted_amount_override: Decimal | None = None,
    ):
        """Обновить транзакцию."""
        transaction = await self.get_by_id(transaction_id, workspace_id)

        update_data = data.model_dump(exclude_unset=True)

        if "account_id" in update_data:
            if update_data["account_id"] is None:
                raise AccountNotFoundForTransactionException(
                    details={"account_id": None}
                )
            account = await self.account_repository.get_by_id(update_data["account_id"])
            if not account or account.workspace_id != workspace_id:
                raise AccountNotFoundForTransactionException(
                    details={"account_id": update_data["account_id"]}
                )

        if "target_account_id" in update_data:
            if (
                update_data["target_account_id"] is None
                and transaction.type == TransactionType.TRANSFER
            ):
                raise TransferRequiresTargetAccountException()
            if update_data["target_account_id"] is not None:
                target = await self.account_repository.get_by_id(
                    update_data["target_account_id"]
                )
                if not target or target.workspace_id != workspace_id:
                    raise AccountNotFoundForTransactionException(
                        details={"target_account_id": update_data["target_account_id"]}
                    )

        if "category_id" in update_data and update_data["category_id"]:
            if transaction.type == TransactionType.TRANSFER:
                raise CategoryNotAllowedForTransferException()

            category = await self.category_repository.get_by_id(
                update_data["category_id"]
            )
            if not category or category.workspace_id != workspace_id:
                raise CategoryNotFoundForTransactionException(
                    details={"category_id": update_data["category_id"]}
                )

        if transaction.type == TransactionType.TRANSFER and (
            "account_id" in update_data
            or "target_account_id" in update_data
            or "amount" in update_data
            or exchange_rate_override is not None
            or converted_amount_override is not None
        ):
            source_account_id = update_data.get("account_id", transaction.account_id)
            target_account_id = update_data.get(
                "target_account_id",
                transaction.target_account_id,
            )

            if not target_account_id:
                raise TransferRequiresTargetAccountException()
            if source_account_id == target_account_id:
                raise TransferToSameAccountException()

            source_account = await self.account_repository.get_by_id(source_account_id)
            target_account = await self.account_repository.get_by_id(target_account_id)
            if not source_account or source_account.workspace_id != workspace_id:
                raise AccountNotFoundForTransactionException(
                    details={"account_id": source_account_id}
                )
            if not target_account or target_account.workspace_id != workspace_id:
                raise AccountNotFoundForTransactionException(
                    details={"target_account_id": target_account_id}
                )

            amount = update_data.get("amount", transaction.amount)
            if converted_amount_override is not None:
                update_data["converted_amount"] = converted_amount_override
                if exchange_rate_override is None:
                    exchange_rate_override = converted_amount_override / amount
                update_data["exchange_rate"] = exchange_rate_override
            elif exchange_rate_override is not None:
                update_data["exchange_rate"] = exchange_rate_override
                update_data["converted_amount"] = amount * exchange_rate_override
            elif source_account.currency_code != target_account.currency_code:
                exchange_rate = await ExchangeRateService().get_rate(
                    source_account.currency_code,
                    target_account.currency_code,
                )
                update_data["exchange_rate"] = exchange_rate
                update_data["converted_amount"] = amount * exchange_rate
            else:
                update_data["exchange_rate"] = None
                update_data["converted_amount"] = amount

        updated = await self.transaction_repository.update(transaction.id, update_data)
        logger.info("Updated transaction %s", transaction_id)
        return updated

    async def delete(self, transaction_id: int, workspace_id: int) -> bool:
        """Удалить транзакцию."""
        await self.get_by_id(transaction_id, workspace_id)
        result = await self.transaction_repository.delete(transaction_id)
        logger.info("Deleted transaction %s", transaction_id)
        return result
