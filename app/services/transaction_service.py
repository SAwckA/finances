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

logger = logging.getLogger(__name__)


# === EXCEPTIONS ===


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


# === SERVICE ===


class TransactionService(BaseService):
    """Сервис для работы с транзакциями."""

    transaction_repository: TransactionRepository
    account_repository: AccountRepository
    category_repository: CategoryRepository

    async def get_user_transactions(
        self,
        user_id: int,
        skip: int = 0,
        limit: int = 100,
    ):
        """Получить транзакции пользователя."""
        return await self.transaction_repository.get_by_user_id(
            user_id=user_id, skip=skip, limit=limit
        )

    async def get_account_transactions(
        self,
        user_id: int,
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
        if account.user_id != user_id:
            raise TransactionAccessDeniedException(details={"account_id": account_id})

        return await self.transaction_repository.get_by_account_id(
            account_id=account_id, skip=skip, limit=limit
        )

    async def get_transactions_by_period(
        self,
        user_id: int,
        start_date: datetime,
        end_date: datetime,
        transaction_type: TransactionType | None = None,
    ):
        """Получить транзакции за период."""
        return await self.transaction_repository.get_by_date_range(
            user_id=user_id,
            start_date=start_date,
            end_date=end_date,
            transaction_type=transaction_type,
        )

    async def get_by_id(self, transaction_id: int, user_id: int):
        """Получить транзакцию по ID с проверкой доступа."""
        transaction = await self.transaction_repository.get_by_id(transaction_id)
        if not transaction:
            raise TransactionNotFoundException(
                details={"transaction_id": transaction_id}
            )
        if transaction.user_id != user_id:
            raise TransactionAccessDeniedException(
                details={"transaction_id": transaction_id}
            )
        return transaction

    async def create(
        self,
        user_id: int,
        data: TransactionCreate,
        exchange_rate: Decimal | None = None,
    ):
        """Создать новую транзакцию."""
        account = await self.account_repository.get_by_id(data.account_id)
        if not account or account.user_id != user_id:
            raise AccountNotFoundForTransactionException(
                details={"account_id": data.account_id}
            )

        transaction_data = {
            "user_id": user_id,
            "type": data.type,
            "account_id": data.account_id,
            "amount": data.amount,
            "description": data.description,
            "transaction_date": data.transaction_date,
        }

        if data.type == TransactionType.TRANSFER:
            await self._validate_transfer(user_id, data)
            transaction_data["target_account_id"] = data.target_account_id

            target_account = None
            if data.target_account_id:
                target_account = await self.account_repository.get_by_id(
                    data.target_account_id
                )
            if target_account and account.currency_id != target_account.currency_id:
                if exchange_rate is None:
                    raise ValidationException(
                        message="Для перевода между разными валютами требуется курс обмена"
                    )
                transaction_data["exchange_rate"] = exchange_rate
                transaction_data["converted_amount"] = data.amount * exchange_rate
            else:
                transaction_data["converted_amount"] = data.amount
        else:
            await self._validate_income_expense(user_id, data)
            if data.category_id:
                transaction_data["category_id"] = data.category_id

        logger.info(
            f"Creating {data.type.value} transaction for user {user_id}: {data.amount}"
        )
        return await self.transaction_repository.create(transaction_data)

    async def _validate_transfer(self, user_id: int, data: TransactionCreate) -> None:
        """Валидация данных для перевода."""
        if not data.target_account_id:
            raise TransferRequiresTargetAccountException()
        if data.account_id == data.target_account_id:
            raise TransferToSameAccountException()
        if data.category_id:
            raise CategoryNotAllowedForTransferException()

        target_account = await self.account_repository.get_by_id(data.target_account_id)
        if not target_account or target_account.user_id != user_id:
            raise AccountNotFoundForTransactionException(
                details={"target_account_id": data.target_account_id}
            )

    async def _validate_income_expense(
        self, user_id: int, data: TransactionCreate
    ) -> None:
        """Валидация данных для дохода/расхода."""
        if data.category_id:
            category = await self.category_repository.get_by_id(data.category_id)
            if not category or category.user_id != user_id:
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

    async def update(self, transaction_id: int, user_id: int, data: TransactionUpdate):
        """Обновить транзакцию."""
        transaction = await self.get_by_id(transaction_id, user_id)

        update_data = data.model_dump(exclude_unset=True)

        if "category_id" in update_data and update_data["category_id"]:
            if transaction.type == TransactionType.TRANSFER:
                raise CategoryNotAllowedForTransferException()

            category = await self.category_repository.get_by_id(
                update_data["category_id"]
            )
            if not category or category.user_id != user_id:
                raise CategoryNotFoundForTransactionException(
                    details={"category_id": update_data["category_id"]}
                )

        updated = await self.transaction_repository.update(transaction.id, update_data)
        logger.info(f"Updated transaction {transaction_id}")
        return updated

    async def delete(self, transaction_id: int, user_id: int) -> bool:
        """Удалить транзакцию."""
        await self.get_by_id(transaction_id, user_id)
        result = await self.transaction_repository.delete(transaction_id)
        logger.info(f"Deleted transaction {transaction_id}")
        return result
