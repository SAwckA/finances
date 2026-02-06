import logging
from datetime import datetime, timezone
from decimal import Decimal

from app.exceptions import BusinessLogicException, ForbiddenException, NotFoundException
from app.models.shopping_list import (
    ShoppingItemCreate,
    ShoppingItemUpdate,
    ShoppingListCreate,
    ShoppingListStatus,
    ShoppingListUpdate,
)
from app.models.transaction import TransactionType
from app.repositories.account_repository import AccountRepository
from app.repositories.category_repository import CategoryRepository
from app.repositories.shopping_list_repository import (
    ShoppingItemRepository,
    ShoppingListRepository,
)
from app.repositories.transaction_repository import TransactionRepository
from app.services.base_service import BaseService

logger = logging.getLogger(__name__)


# === EXCEPTIONS ===


class ShoppingListNotFoundException(NotFoundException):
    """Список покупок не найден."""

    message = "Список покупок не найден"


class ShoppingItemNotFoundException(NotFoundException):
    """Товар в списке не найден."""

    message = "Товар в списке не найден"


class ShoppingListAccessDeniedException(ForbiddenException):
    """Доступ к списку покупок запрещён."""

    message = "Доступ к списку покупок запрещён"


class AccountNotFoundForShoppingListException(NotFoundException):
    """Счёт для списка покупок не найден."""

    message = "Указанный счёт не найден"


class CategoryNotFoundForShoppingListException(NotFoundException):
    """Категория для списка покупок не найдена."""

    message = "Указанная категория не найдена"


class ShoppingListAlreadyCompletedException(BusinessLogicException):
    """Список покупок уже завершён."""

    message = "Список покупок уже завершён"


class ShoppingListNotConfirmedException(BusinessLogicException):
    """Список покупок не подтверждён."""

    message = "Необходимо сначала подтвердить список покупок"


class ShoppingListEmptyException(BusinessLogicException):
    """Список покупок пуст."""

    message = "Невозможно завершить пустой список покупок"


class ShoppingListIncompletePricesException(BusinessLogicException):
    """Не все цены заполнены."""

    message = "Необходимо указать цены для всех товаров"


class ShoppingListItemsLockedException(BusinessLogicException):
    """Товары можно менять только в режиме черновика."""

    message = "Изменение товаров доступно только в режиме черновика"


class ShoppingListPricesLockedException(BusinessLogicException):
    """Цены можно менять только в подтвержденном списке."""

    message = "Цены можно указывать только после подтверждения списка"


# === SERVICE ===


class ShoppingListService(BaseService):
    """Сервис для работы со списками покупок."""

    shopping_list_repository: ShoppingListRepository
    shopping_item_repository: ShoppingItemRepository
    account_repository: AccountRepository
    category_repository: CategoryRepository
    transaction_repository: TransactionRepository

    async def get_user_lists(
        self,
        user_id: int,
        status: ShoppingListStatus | None = None,
        skip: int = 0,
        limit: int = 100,
    ):
        """Получить списки покупок пользователя."""
        return await self.shopping_list_repository.get_by_user_id(
            user_id=user_id, status=status, skip=skip, limit=limit
        )

    async def get_by_id(self, list_id: int, user_id: int):
        """Получить список покупок по ID с проверкой доступа."""
        shopping_list = await self.shopping_list_repository.get_user_list(
            user_id=user_id, list_id=list_id
        )
        if not shopping_list:
            raise ShoppingListNotFoundException(details={"list_id": list_id})
        return shopping_list

    async def create(self, user_id: int, data: ShoppingListCreate):
        """Создать новый список покупок."""
        await self._validate_account(user_id, data.account_id)
        await self._validate_category(user_id, data.category_id)

        list_data = {
            "user_id": user_id,
            "name": data.name,
            "account_id": data.account_id,
            "category_id": data.category_id,
            "status": ShoppingListStatus.DRAFT,
        }

        shopping_list = await self.shopping_list_repository.create(list_data)

        if data.items:
            items_data = [item.model_dump() for item in data.items]
            await self.shopping_item_repository.bulk_create(
                shopping_list.id, items_data
            )

        logger.info(f"Created shopping list '{data.name}' for user {user_id}")
        return await self.shopping_list_repository.get_by_id_with_items(
            shopping_list.id
        )

    async def update(self, list_id: int, user_id: int, data: ShoppingListUpdate):
        """Обновить список покупок."""
        shopping_list = await self.get_by_id(list_id, user_id)

        if shopping_list.status == ShoppingListStatus.COMPLETED:
            raise ShoppingListAlreadyCompletedException()

        update_data = data.model_dump(exclude_unset=True)

        if "account_id" in update_data:
            await self._validate_account(user_id, update_data["account_id"])
        if "category_id" in update_data:
            await self._validate_category(user_id, update_data["category_id"])

        await self.shopping_list_repository.update(list_id, update_data)
        logger.info(f"Updated shopping list {list_id}")
        return await self.shopping_list_repository.get_by_id_with_items(list_id)

    async def delete(self, list_id: int, user_id: int) -> bool:
        """Удалить список покупок."""
        await self.get_by_id(list_id, user_id)
        result = await self.shopping_list_repository.delete(list_id)
        logger.info(f"Deleted shopping list {list_id}")
        return result

    async def add_item(self, list_id: int, user_id: int, data: ShoppingItemCreate):
        """Добавить товар в список."""
        shopping_list = await self.get_by_id(list_id, user_id)

        if shopping_list.status == ShoppingListStatus.COMPLETED:
            raise ShoppingListAlreadyCompletedException()

        if shopping_list.status != ShoppingListStatus.DRAFT:
            raise ShoppingListItemsLockedException()

        if data.price is not None:
            raise ShoppingListPricesLockedException()

        item_data = data.model_dump()
        item_data["shopping_list_id"] = list_id
        item = await self.shopping_item_repository.create(item_data)
        logger.info(f"Added item '{data.name}' to shopping list {list_id}")
        return item

    async def update_item(
        self, list_id: int, item_id: int, user_id: int, data: ShoppingItemUpdate
    ):
        """Обновить товар в списке."""
        shopping_list = await self.get_by_id(list_id, user_id)

        if shopping_list.status == ShoppingListStatus.COMPLETED:
            raise ShoppingListAlreadyCompletedException()

        if shopping_list.status == ShoppingListStatus.DRAFT and data.price is not None:
            raise ShoppingListPricesLockedException()

        if shopping_list.status == ShoppingListStatus.CONFIRMED and (
            data.name is not None or data.quantity is not None
        ):
            raise ShoppingListItemsLockedException()

        item = await self.shopping_item_repository.get_list_item(list_id, item_id)
        if not item:
            raise ShoppingItemNotFoundException(details={"item_id": item_id})

        update_data = data.model_dump(exclude_unset=True)
        updated = await self.shopping_item_repository.update(item_id, update_data)
        logger.info(f"Updated item {item_id} in shopping list {list_id}")
        return updated

    async def remove_item(self, list_id: int, item_id: int, user_id: int) -> bool:
        """Удалить товар из списка."""
        shopping_list = await self.get_by_id(list_id, user_id)

        if shopping_list.status == ShoppingListStatus.COMPLETED:
            raise ShoppingListAlreadyCompletedException()

        if shopping_list.status != ShoppingListStatus.DRAFT:
            raise ShoppingListItemsLockedException()

        item = await self.shopping_item_repository.get_list_item(list_id, item_id)
        if not item:
            raise ShoppingItemNotFoundException(details={"item_id": item_id})

        result = await self.shopping_item_repository.delete(item_id)
        logger.info(f"Removed item {item_id} from shopping list {list_id}")
        return result

    async def confirm(self, list_id: int, user_id: int):
        """Подтвердить список покупок."""
        shopping_list = await self.get_by_id(list_id, user_id)

        if shopping_list.status == ShoppingListStatus.COMPLETED:
            raise ShoppingListAlreadyCompletedException()

        if shopping_list.status == ShoppingListStatus.CONFIRMED:
            return await self.shopping_list_repository.get_by_id_with_items(list_id)

        await self.shopping_list_repository.update(
            list_id,
            {
                "status": ShoppingListStatus.CONFIRMED,
                "confirmed_at": datetime.now(timezone.utc),
            },
        )
        logger.info(f"Confirmed shopping list {list_id}")
        return await self.shopping_list_repository.get_by_id_with_items(list_id)

    async def revert_to_draft(self, list_id: int, user_id: int):
        """Вернуть список покупок в режим черновика."""
        shopping_list = await self.get_by_id(list_id, user_id)

        if shopping_list.status == ShoppingListStatus.COMPLETED:
            raise ShoppingListAlreadyCompletedException()

        if shopping_list.status == ShoppingListStatus.DRAFT:
            return await self.shopping_list_repository.get_by_id_with_items(list_id)

        await self.shopping_list_repository.update(
            list_id,
            {
                "status": ShoppingListStatus.DRAFT,
                "confirmed_at": None,
            },
        )
        logger.info(f"Reverted shopping list {list_id} to draft")
        return await self.shopping_list_repository.get_by_id_with_items(list_id)

    async def complete(self, list_id: int, user_id: int):
        """
        Завершить список покупок и создать транзакцию.

        Создаёт детализированную транзакцию с привязкой к списку покупок.
        """
        shopping_list = await self.get_by_id(list_id, user_id)

        if shopping_list.status == ShoppingListStatus.COMPLETED:
            raise ShoppingListAlreadyCompletedException()

        if shopping_list.status != ShoppingListStatus.CONFIRMED:
            raise ShoppingListNotConfirmedException()

        if not shopping_list.items:
            raise ShoppingListEmptyException()

        total_amount = Decimal("0")
        for item in shopping_list.items:
            if item.price is None:
                raise ShoppingListIncompletePricesException()
            total_amount += item.price * item.quantity

        transaction_data = {
            "user_id": user_id,
            "type": TransactionType.EXPENSE,
            "account_id": shopping_list.account_id,
            "category_id": shopping_list.category_id,
            "amount": total_amount,
            "description": f"Список покупок: {shopping_list.name}",
            "transaction_date": datetime.now(timezone.utc),
            "shopping_list_id": list_id,
        }

        transaction = await self.transaction_repository.create(transaction_data)

        await self.shopping_list_repository.update(
            list_id,
            {
                "status": ShoppingListStatus.COMPLETED,
                "completed_at": datetime.now(timezone.utc),
                "total_amount": total_amount,
            },
        )

        logger.info(
            f"Completed shopping list {list_id}, created transaction {transaction.id}"
        )
        return await self.shopping_list_repository.get_by_id_with_items(list_id)

    async def _validate_account(self, user_id: int, account_id: int) -> None:
        """Проверить существование и доступ к счёту."""
        account = await self.account_repository.get_by_id(account_id)
        if not account or account.user_id != user_id:
            raise AccountNotFoundForShoppingListException(
                details={"account_id": account_id}
            )

    async def _validate_category(self, user_id: int, category_id: int) -> None:
        """Проверить существование и доступ к категории."""
        category = await self.category_repository.get_by_id(category_id)
        if not category or category.user_id != user_id:
            raise CategoryNotFoundForShoppingListException(
                details={"category_id": category_id}
            )
