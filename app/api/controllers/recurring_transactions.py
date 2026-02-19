from datetime import date

from fastapi import APIRouter, Depends, Query

from app.api.dependencies.auth import (
    WorkspaceContext,
    get_current_workspace_context,
)
from app.models.recurring_transaction import (
    RecurringTransactionCreate,
    RecurringTransactionResponse,
    RecurringTransactionUpdate,
)
from app.models.transaction import TransactionResponse
from app.services.recurring_transaction_service import RecurringTransactionService

router = APIRouter(prefix="/recurring-transactions", tags=["recurring-transactions"])


@router.get("", response_model=list[RecurringTransactionResponse])
async def get_recurring_transactions(
    is_active: bool | None = Query(None, description="Фильтр по активности"),
    skip: int = 0,
    limit: int = 100,
    workspace: WorkspaceContext = Depends(get_current_workspace_context),
):
    """Получить все периодические транзакции активного workspace."""
    async with RecurringTransactionService() as service:
        return await service.get_workspace_recurring_transactions(
            workspace_id=workspace.workspace_id,
            is_active=is_active,
            skip=skip,
            limit=limit,
        )


@router.get("/pending", response_model=list[RecurringTransactionResponse])
async def get_pending_recurring_transactions(
    as_of_date: date | None = Query(
        None, description="Дата для проверки (по умолчанию сегодня)"
    ),
    workspace: WorkspaceContext = Depends(get_current_workspace_context),
):
    """Получить периодические транзакции, ожидающие выполнения."""
    async with RecurringTransactionService() as service:
        return await service.get_pending(
            workspace_id=workspace.workspace_id,
            as_of_date=as_of_date,
        )


@router.get("/{recurring_id}", response_model=RecurringTransactionResponse)
async def get_recurring_transaction(
    recurring_id: int,
    workspace: WorkspaceContext = Depends(get_current_workspace_context),
):
    """Получить периодическую транзакцию по ID."""
    async with RecurringTransactionService() as service:
        return await service.get_by_id(
            recurring_id=recurring_id,
            workspace_id=workspace.workspace_id,
        )


@router.post("", response_model=RecurringTransactionResponse, status_code=201)
async def create_recurring_transaction(
    data: RecurringTransactionCreate,
    workspace: WorkspaceContext = Depends(get_current_workspace_context),
):
    """Создать новую периодическую транзакцию."""
    async with RecurringTransactionService() as service:
        return await service.create(
            workspace_id=workspace.workspace_id,
            actor_user_id=workspace.user.id,
            data=data,
        )


@router.patch("/{recurring_id}", response_model=RecurringTransactionResponse)
async def update_recurring_transaction(
    recurring_id: int,
    data: RecurringTransactionUpdate,
    workspace: WorkspaceContext = Depends(get_current_workspace_context),
):
    """Обновить периодическую транзакцию."""
    async with RecurringTransactionService() as service:
        return await service.update(
            recurring_id=recurring_id,
            workspace_id=workspace.workspace_id,
            data=data,
        )


@router.delete("/{recurring_id}", status_code=204)
async def delete_recurring_transaction(
    recurring_id: int,
    workspace: WorkspaceContext = Depends(get_current_workspace_context),
):
    """Удалить периодическую транзакцию."""
    async with RecurringTransactionService() as service:
        await service.delete(
            recurring_id=recurring_id,
            workspace_id=workspace.workspace_id,
        )


@router.post("/{recurring_id}/deactivate", response_model=RecurringTransactionResponse)
async def deactivate_recurring_transaction(
    recurring_id: int,
    workspace: WorkspaceContext = Depends(get_current_workspace_context),
):
    """Деактивировать периодическую транзакцию."""
    async with RecurringTransactionService() as service:
        return await service.deactivate(
            recurring_id=recurring_id,
            workspace_id=workspace.workspace_id,
        )


@router.post("/{recurring_id}/activate", response_model=RecurringTransactionResponse)
async def activate_recurring_transaction(
    recurring_id: int,
    workspace: WorkspaceContext = Depends(get_current_workspace_context),
):
    """Активировать периодическую транзакцию."""
    async with RecurringTransactionService() as service:
        return await service.activate(
            recurring_id=recurring_id,
            workspace_id=workspace.workspace_id,
        )


@router.post("/{recurring_id}/execute", response_model=TransactionResponse)
async def execute_recurring_transaction(
    recurring_id: int,
    workspace: WorkspaceContext = Depends(get_current_workspace_context),
):
    """
    Выполнить периодическую транзакцию вручную.

    Создаёт реальную транзакцию и обновляет дату следующего выполнения.
    """
    async with RecurringTransactionService() as service:
        return await service.execute(
            recurring_id=recurring_id,
            workspace_id=workspace.workspace_id,
        )
