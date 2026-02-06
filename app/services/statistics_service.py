import logging
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal

from app.models.transaction import TransactionType
from app.repositories.account_repository import AccountRepository
from app.repositories.category_repository import CategoryRepository
from app.repositories.currency_repository import CurrencyRepository
from app.repositories.transaction_repository import TransactionRepository
from app.services.base_service import BaseService
from app.services.exchange_rate_service import ExchangeRateService

logger = logging.getLogger(__name__)


# === DATA CLASSES ===


@dataclass
class AccountBalance:
    """Баланс счёта."""

    account_id: int
    account_name: str
    currency_code: str
    currency_symbol: str
    balance: Decimal


@dataclass
class CategorySummary:
    """Сумма по категории."""

    category_id: int
    category_name: str
    category_icon: str
    category_color: str
    amount: Decimal


@dataclass
class PeriodStatistics:
    """Статистика за период."""

    start_date: datetime
    end_date: datetime
    total_income: Decimal
    total_expense: Decimal
    net_change: Decimal
    income_by_category: list[CategorySummary]
    expense_by_category: list[CategorySummary]


# === SERVICE ===


class StatisticsService(BaseService):
    """Сервис для статистики и аналитики."""

    account_repository: AccountRepository
    transaction_repository: TransactionRepository
    category_repository: CategoryRepository
    currency_repository: CurrencyRepository

    async def get_account_balance(
        self, account_id: int, user_id: int
    ) -> AccountBalance:
        """Получить баланс конкретного счёта."""
        account = await self.account_repository.get_user_account(
            user_id=user_id, account_id=account_id
        )
        if not account:
            from app.services.account_service import AccountNotFoundException

            raise AccountNotFoundException(details={"account_id": account_id})

        currency = await self.currency_repository.get_by_code(account.currency_code)
        balance = await self.transaction_repository.get_account_balance(account_id)

        return AccountBalance(
            account_id=account.id,
            account_name=account.name,
            currency_code=currency.code if currency else "???",
            currency_symbol=currency.symbol if currency else "?",
            balance=balance,
        )

    async def get_all_balances(self, user_id: int) -> list[AccountBalance]:
        """Получить балансы всех счетов пользователя."""
        accounts = await self.account_repository.get_by_user_id(user_id)
        balances = []

        for account in accounts:
            currency = await self.currency_repository.get_by_code(account.currency_code)
            balance = await self.transaction_repository.get_account_balance(account.id)
            balances.append(
                AccountBalance(
                    account_id=account.id,
                    account_name=account.name,
                    currency_code=currency.code if currency else "???",
                    currency_symbol=currency.symbol if currency else "?",
                    balance=balance,
                )
            )

        return balances

    async def get_total_balance(
        self,
        user_id: int,
        target_currency_code: str,
    ) -> Decimal:
        """
        Получить общий баланс всех счетов в указанной валюте.

        Args:
            user_id: ID пользователя
            target_currency_code: Код валюты для отображения (например, "RUB")

        Returns:
            Общий баланс в указанной валюте
        """
        accounts = await self.account_repository.get_by_user_id(user_id)
        exchange_service = ExchangeRateService()
        total = Decimal("0")

        for account in accounts:
            currency = await self.currency_repository.get_by_code(account.currency_code)
            balance = await self.transaction_repository.get_account_balance(account.id)

            if not currency:
                continue

            if currency.code == target_currency_code.upper():
                total += balance
            else:
                converted = await exchange_service.convert(
                    amount=balance,
                    from_currency=currency.code,
                    to_currency=target_currency_code,
                )
                total += converted

        return total

    async def get_period_statistics(
        self,
        user_id: int,
        start_date: datetime,
        end_date: datetime,
        account_ids: list[int] | None = None,
        target_currency_code: str | None = None,
    ) -> PeriodStatistics:
        """
        Получить статистику за период.

        Args:
            user_id: ID пользователя
            start_date: Начало периода
            end_date: Конец периода
            target_currency_code: Целевая валюта для итоговых сумм

        Returns:
            Статистика с доходами/расходами по категориям
        """
        income_by_category = await self._get_category_summary(
            user_id=user_id,
            start_date=start_date,
            end_date=end_date,
            transaction_type=TransactionType.INCOME,
            account_ids=account_ids,
        )

        expense_by_category = await self._get_category_summary(
            user_id=user_id,
            start_date=start_date,
            end_date=end_date,
            transaction_type=TransactionType.EXPENSE,
            account_ids=account_ids,
        )

        if target_currency_code:
            total_income = await self._get_total_by_type_in_currency(
                user_id=user_id,
                start_date=start_date,
                end_date=end_date,
                transaction_type=TransactionType.INCOME,
                account_ids=account_ids,
                target_currency_code=target_currency_code,
            )
            total_expense = await self._get_total_by_type_in_currency(
                user_id=user_id,
                start_date=start_date,
                end_date=end_date,
                transaction_type=TransactionType.EXPENSE,
                account_ids=account_ids,
                target_currency_code=target_currency_code,
            )
        else:
            total_income = await self.transaction_repository.get_sum_by_type(
                user_id=user_id,
                start_date=start_date,
                end_date=end_date,
                transaction_type=TransactionType.INCOME,
                account_ids=account_ids,
            )
            total_expense = await self.transaction_repository.get_sum_by_type(
                user_id=user_id,
                start_date=start_date,
                end_date=end_date,
                transaction_type=TransactionType.EXPENSE,
                account_ids=account_ids,
            )

        return PeriodStatistics(
            start_date=start_date,
            end_date=end_date,
            total_income=total_income,
            total_expense=total_expense,
            net_change=total_income - total_expense,
            income_by_category=income_by_category,
            expense_by_category=expense_by_category,
        )

    async def _get_total_by_type_in_currency(
        self,
        user_id: int,
        start_date: datetime,
        end_date: datetime,
        transaction_type: TransactionType,
        account_ids: list[int] | None,
        target_currency_code: str,
    ) -> Decimal:
        exchange_service = ExchangeRateService()
        totals_by_account = (
            await self.transaction_repository.get_sum_by_type_by_account(
                user_id=user_id,
                start_date=start_date,
                end_date=end_date,
                transaction_type=transaction_type,
                account_ids=account_ids,
            )
        )
        accounts = await self.account_repository.get_by_user_id(user_id)
        account_map = {account.id: account for account in accounts}
        total = Decimal("0")
        target_code = target_currency_code.upper()

        for account_id, amount in totals_by_account:
            account = account_map.get(account_id)
            if not account:
                continue
            currency = await self.currency_repository.get_by_code(account.currency_code)
            if not currency:
                continue
            if currency.code == target_code:
                total += amount
            else:
                converted = await exchange_service.convert(
                    amount=amount,
                    from_currency=currency.code,
                    to_currency=target_code,
                )
                total += converted

        return total

    async def _get_category_summary(
        self,
        user_id: int,
        start_date: datetime,
        end_date: datetime,
        transaction_type: TransactionType,
        account_ids: list[int] | None = None,
    ) -> list[CategorySummary]:
        """Получить суммы по категориям."""
        category_sums = await self.transaction_repository.get_sum_by_category(
            user_id=user_id,
            start_date=start_date,
            end_date=end_date,
            transaction_type=transaction_type,
            account_ids=account_ids,
        )

        summaries = []
        for category_id, amount in category_sums:
            if category_id is None:
                continue
            category = await self.category_repository.get_by_id(category_id)
            if category:
                summaries.append(
                    CategorySummary(
                        category_id=category.id,
                        category_name=category.name,
                        category_icon=category.icon,
                        category_color=category.color,
                        amount=amount,
                    )
                )

        summaries.sort(key=lambda x: x.amount, reverse=True)
        return summaries
