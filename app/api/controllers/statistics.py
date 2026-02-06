from datetime import datetime
from decimal import Decimal

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from app.api.dependencies.auth import get_current_active_user
from app.models.user import User
from app.services.statistics_service import StatisticsService


# === RESPONSE SCHEMAS ===


class AccountBalanceResponse(BaseModel):
    """Ответ с балансом счёта."""

    account_id: int
    account_name: str
    currency_code: str
    currency_symbol: str
    balance: Decimal


class TotalBalanceResponse(BaseModel):
    """Ответ с общим балансом."""

    total_balance: Decimal
    currency_code: str


class CategorySummaryResponse(BaseModel):
    """Ответ с суммой по категории."""

    category_id: int
    category_name: str
    category_icon: str
    category_color: str
    amount: Decimal


class PeriodStatisticsResponse(BaseModel):
    """Ответ со статистикой за период."""

    start_date: datetime
    end_date: datetime
    total_income: Decimal
    total_expense: Decimal
    net_change: Decimal
    income_by_category: list[CategorySummaryResponse]
    expense_by_category: list[CategorySummaryResponse]


router = APIRouter(prefix="/statistics", tags=["statistics"])


@router.get("/balance", response_model=list[AccountBalanceResponse])
async def get_all_balances(
    current_user: User = Depends(get_current_active_user),
):
    """Получить балансы всех счетов пользователя."""
    async with StatisticsService() as service:
        balances = await service.get_all_balances(user_id=current_user.id)
        return [
            AccountBalanceResponse(
                account_id=b.account_id,
                account_name=b.account_name,
                currency_code=b.currency_code,
                currency_symbol=b.currency_symbol,
                balance=b.balance,
            )
            for b in balances
        ]


@router.get("/balance/{account_id}", response_model=AccountBalanceResponse)
async def get_account_balance(
    account_id: int,
    current_user: User = Depends(get_current_active_user),
):
    """Получить баланс конкретного счёта."""
    async with StatisticsService() as service:
        balance = await service.get_account_balance(
            account_id=account_id, user_id=current_user.id
        )
        return AccountBalanceResponse(
            account_id=balance.account_id,
            account_name=balance.account_name,
            currency_code=balance.currency_code,
            currency_symbol=balance.currency_symbol,
            balance=balance.balance,
        )


@router.get("/total", response_model=TotalBalanceResponse)
async def get_total_balance(
    currency: str = Query("RUB", description="Код валюты для отображения"),
    current_user: User = Depends(get_current_active_user),
):
    """Получить общий баланс всех счетов в указанной валюте."""
    async with StatisticsService() as service:
        total = await service.get_total_balance(
            user_id=current_user.id, target_currency_code=currency
        )
        return TotalBalanceResponse(total_balance=total, currency_code=currency.upper())


@router.get("/summary", response_model=PeriodStatisticsResponse)
async def get_period_statistics(
    start_date: datetime = Query(..., description="Начало периода"),
    end_date: datetime = Query(..., description="Конец периода"),
    account_ids: list[int] | None = Query(None, description="Фильтр по счетам"),
    currency: str | None = Query(None, description="Целевая валюта для итогов"),
    current_user: User = Depends(get_current_active_user),
):
    """Получить статистику доходов и расходов за период."""
    async with StatisticsService() as service:
        stats = await service.get_period_statistics(
            user_id=current_user.id,
            start_date=start_date,
            end_date=end_date,
            account_ids=account_ids,
            target_currency_code=currency,
        )
        return PeriodStatisticsResponse(
            start_date=stats.start_date,
            end_date=stats.end_date,
            total_income=stats.total_income,
            total_expense=stats.total_expense,
            net_change=stats.net_change,
            income_by_category=[
                CategorySummaryResponse(
                    category_id=c.category_id,
                    category_name=c.category_name,
                    category_icon=c.category_icon,
                    category_color=c.category_color,
                    amount=c.amount,
                )
                for c in stats.income_by_category
            ],
            expense_by_category=[
                CategorySummaryResponse(
                    category_id=c.category_id,
                    category_name=c.category_name,
                    category_icon=c.category_icon,
                    category_color=c.category_color,
                    amount=c.amount,
                )
                for c in stats.expense_by_category
            ],
        )
