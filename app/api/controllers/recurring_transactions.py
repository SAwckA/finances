from datetime import date

from fastapi import APIRouter, Depends, Query

from app.api.dependencies.auth import get_current_active_user
from app.models.recurring_transaction import (
    RecurringTransactionCreate,
    RecurringTransactionResponse,
    RecurringTransactionUpdate,
)
from app.models.transaction import TransactionResponse
from app.models.user import User
from app.services.recurring_transaction_service import RecurringTransactionService

router = APIRouter(prefix="/recurring-transactions", tags=["recurring-transactions"])


@router.get("", response_model=list[RecurringTransactionResponse])
async def get_recurring_transactions(
    is_active: bool | None = Query(None, description="Фильтр по активности"),
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_active_user),
):
    """Получить все периодические транзакции пользователя."""
    async with RecurringTransactionService() as service:
        return await service.get_user_recurring_transactions(
            user_id=current_user.id, is_active=is_active, skip=skip, limit=limit
        )


@router.get("/pending", response_model=list[RecurringTransactionResponse])
async def get_pending_recurring_transactions(
    as_of_date: date | None = Query(None, description="Дата для проверки (по умолчанию сегодня)"),
    current_user: User = Depends(get_current_active_user),
):
    """Получить периодические транзакции, ожидающие выполнения."""
    async with RecurringTransactionService() as service:
        return await service.get_pending(user_id=current_user.id, as_of_date=as_of_date)


@router.get("/{recurring_id}", response_model=RecurringTransactionResponse)
async def get_recurring_transaction(
    recurring_id: int,
    current_user: User = Depends(get_current_active_user),
):
    """Получить периодическую транзакцию по ID."""
    async with RecurringTransactionService() as service:
        return await service.get_by_id(
            recurring_id=recurring_id, user_id=current_user.id
        )


@router.post("", response_model=RecurringTransactionResponse, status_code=201)
async def create_recurring_transaction(
    data: RecurringTransactionCreate,
    current_user: User = Depends(get_current_active_user),
):
    """Создать новую периодическую транзакцию."""
    async with RecurringTransactionService() as service:
        return await service.create(user_id=current_user.id, data=data)


@router.patch("/{recurring_id}", response_model=RecurringTransactionResponse)
async def update_recurring_transaction(
    recurring_id: int,
    data: RecurringTransactionUpdate,
    current_user: User = Depends(get_current_active_user),
):
    """Обновить периодическую транзакцию."""
    async with RecurringTransactionService() as service:
        return await service.update(
            recurring_id=recurring_id, user_id=current_user.id, data=data
        )


@router.delete("/{recurring_id}", status_code=204)
async def delete_recurring_transaction(
    recurring_id: int,
    current_user: User = Depends(get_current_active_user),
):
    """Удалить периодическую транзакцию."""
    async with RecurringTransactionService() as service:
        await service.delete(recurring_id=recurring_id, user_id=current_user.id)


@router.post("/{recurring_id}/deactivate", response_model=RecurringTransactionResponse)
async def deactivate_recurring_transaction(
    recurring_id: int,
    current_user: User = Depends(get_current_active_user),
):
    """Деактивировать периодическую транзакцию."""
    async with RecurringTransactionService() as service:
        return await service.deactivate(
            recurring_id=recurring_id, user_id=current_user.id
        )


@router.post("/{recurring_id}/activate", response_model=RecurringTransactionResponse)
async def activate_recurring_transaction(
    recurring_id: int,
    current_user: User = Depends(get_current_active_user),
):
    """Активировать периодическую транзакцию."""
    async with RecurringTransactionService() as service:
        return await service.activate(
            recurring_id=recurring_id, user_id=current_user.id
        )


@router.post("/{recurring_id}/execute", response_model=TransactionResponse)
async def execute_recurring_transaction(
    recurring_id: int,
    current_user: User = Depends(get_current_active_user),
):
    """
    Выполнить периодическую транзакцию вручную.

    Создаёт реальную транзакцию и обновляет дату следующего выполнения.
    """
    async with RecurringTransactionService() as service:
        return await service.execute(
            recurring_id=recurring_id, user_id=current_user.id
        )

