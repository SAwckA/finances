import logging

from app.exceptions import ForbiddenException, NotFoundException
from app.models.account import AccountCreate, AccountUpdate
from app.repositories.account_repository import AccountRepository
from app.repositories.currency_repository import CurrencyRepository
from app.services.base_service import BaseService

logger = logging.getLogger(__name__)


# === EXCEPTIONS ===


class AccountNotFoundException(NotFoundException):
    """Счёт не найден."""

    message = "Счёт не найден"


class AccountAccessDeniedException(ForbiddenException):
    """Доступ к счёту запрещён."""

    message = "Доступ к счёту запрещён"


class CurrencyNotFoundForAccountException(NotFoundException):
    """Валюта для счёта не найдена."""

    message = "Указанная валюта не найдена"


# === SERVICE ===


class AccountService(BaseService):
    """Сервис для работы со счетами."""

    account_repository: AccountRepository
    currency_repository: CurrencyRepository

    async def get_user_accounts(self, user_id: int, skip: int = 0, limit: int = 100):
        """Получить все счета пользователя."""
        return await self.account_repository.get_by_user_id(
            user_id=user_id, skip=skip, limit=limit
        )

    async def get_by_id(self, account_id: int, user_id: int):
        """Получить счёт по ID с проверкой доступа."""
        account = await self.account_repository.get_by_id(account_id)
        if not account:
            raise AccountNotFoundException(details={"account_id": account_id})
        if account.user_id != user_id:
            raise AccountAccessDeniedException(details={"account_id": account_id})
        return account

    async def create(self, user_id: int, data: AccountCreate):
        """Создать новый счёт."""
        currency = await self.currency_repository.get_by_id(data.currency_id)
        if not currency:
            raise CurrencyNotFoundForAccountException(
                details={"currency_id": data.currency_id}
            )

        account_data = data.model_dump()
        account_data["user_id"] = user_id
        logger.info(f"Creating account '{data.name}' for user {user_id}")
        return await self.account_repository.create(account_data)

    async def update(self, account_id: int, user_id: int, data: AccountUpdate):
        """Обновить счёт."""
        account = await self.get_by_id(account_id, user_id)

        update_data = data.model_dump(exclude_unset=True)
        if "currency_id" in update_data:
            currency = await self.currency_repository.get_by_id(
                update_data["currency_id"]
            )
            if not currency:
                raise CurrencyNotFoundForAccountException(
                    details={"currency_id": update_data["currency_id"]}
                )

        updated = await self.account_repository.update(account.id, update_data)
        logger.info(f"Updated account {account_id}")
        return updated

    async def delete(self, account_id: int, user_id: int) -> bool:
        """Удалить счёт."""
        await self.get_by_id(account_id, user_id)
        result = await self.account_repository.delete(account_id)
        logger.info(f"Deleted account {account_id}")
        return result
