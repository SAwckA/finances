from datetime import datetime
from decimal import Decimal

from fastapi import APIRouter, Depends, Query

from app.api.dependencies.auth import get_current_active_user
from app.models.transaction import (
    TransactionCreate,
    TransactionResponse,
    TransactionType,
    TransactionUpdate,
)
from app.models.user import User
from app.services.exchange_rate_service import ExchangeRateService
from app.services.transaction_service import TransactionService

router = APIRouter(prefix="/transactions", tags=["transactions"])


@router.get("", response_model=list[TransactionResponse])
async def get_transactions(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_active_user),
):
    """Получить все транзакции текущего пользователя."""
    async with TransactionService() as service:
        return await service.get_user_transactions(
            user_id=current_user.id, skip=skip, limit=limit
        )


@router.get("/account/{account_id}", response_model=list[TransactionResponse])
async def get_account_transactions(
    account_id: int,
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_active_user),
):
    """Получить транзакции по счёту."""
    async with TransactionService() as service:
        return await service.get_account_transactions(
            user_id=current_user.id,
            account_id=account_id,
            skip=skip,
            limit=limit,
        )


@router.get("/period", response_model=list[TransactionResponse])
async def get_transactions_by_period(
    start_date: datetime = Query(..., description="Начало периода"),
    end_date: datetime = Query(..., description="Конец периода"),
    transaction_type: TransactionType | None = Query(
        None, description="Тип транзакции"
    ),
    current_user: User = Depends(get_current_active_user),
):
    """Получить транзакции за период."""
    async with TransactionService() as service:
        return await service.get_transactions_by_period(
            user_id=current_user.id,
            start_date=start_date,
            end_date=end_date,
            transaction_type=transaction_type,
        )


@router.get("/{transaction_id}", response_model=TransactionResponse)
async def get_transaction(
    transaction_id: int,
    current_user: User = Depends(get_current_active_user),
):
    """Получить транзакцию по ID."""
    async with TransactionService() as service:
        return await service.get_by_id(
            transaction_id=transaction_id, user_id=current_user.id
        )


@router.post("", response_model=TransactionResponse, status_code=201)
async def create_transaction(
    data: TransactionCreate,
    converted_amount: Decimal | None = Query(None, description="Сумма получения"),
    exchange_rate: Decimal | None = Query(None, description="Курс обмена"),
    current_user: User = Depends(get_current_active_user),
):
    """Создать новую транзакцию."""
    exchange_rate_override = exchange_rate
    converted_amount_override = converted_amount

    if (
        data.type == TransactionType.TRANSFER
        and data.target_account_id
        and exchange_rate_override is None
        and converted_amount_override is not None
    ):
        exchange_rate_override = converted_amount_override / data.amount

    if (
        data.type == TransactionType.TRANSFER
        and data.target_account_id
        and exchange_rate_override is None
    ):
        async with ExchangeRateService() as exchange_service:
            from app.services.account_service import AccountService

            async with AccountService() as account_service:
                source = await account_service.get_by_id(
                    data.account_id, current_user.id
                )
                target = await account_service.get_by_id(
                    data.target_account_id, current_user.id
                )

                if source.currency_code != target.currency_code:
                    exchange_rate_override = await exchange_service.get_rate(
                        source.currency_code, target.currency_code
                    )

    async with TransactionService() as service:
        return await service.create(
            user_id=current_user.id,
            data=data,
            exchange_rate=exchange_rate_override,
            converted_amount=converted_amount_override,
        )


@router.patch("/{transaction_id}", response_model=TransactionResponse)
async def update_transaction(
    transaction_id: int,
    data: TransactionUpdate,
    converted_amount: Decimal | None = Query(None, description="Сумма получения"),
    exchange_rate: Decimal | None = Query(None, description="Курс обмена"),
    current_user: User = Depends(get_current_active_user),
):
    """Обновить транзакцию."""
    async with TransactionService() as service:
        return await service.update(
            transaction_id=transaction_id,
            user_id=current_user.id,
            data=data,
            exchange_rate_override=exchange_rate,
            converted_amount_override=converted_amount,
        )


@router.delete("/{transaction_id}", status_code=204)
async def delete_transaction(
    transaction_id: int,
    current_user: User = Depends(get_current_active_user),
):
    """Удалить транзакцию."""
    async with TransactionService() as service:
        await service.delete(transaction_id=transaction_id, user_id=current_user.id)
