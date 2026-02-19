from fastapi import APIRouter, Depends

from app.api.dependencies.auth import (
    WorkspaceContext,
    get_current_workspace_context,
)
from app.models.account import AccountCreate, AccountResponse, AccountUpdate
from app.services.account_service import AccountService

router = APIRouter(prefix="/accounts", tags=["accounts"])


@router.get("", response_model=list[AccountResponse])
async def get_accounts(
    skip: int = 0,
    limit: int = 100,
    workspace: WorkspaceContext = Depends(get_current_workspace_context),
):
    """Получить все счета активного workspace."""
    async with AccountService() as service:
        return await service.get_workspace_accounts(
            workspace_id=workspace.workspace_id,
            skip=skip,
            limit=limit,
        )


@router.get("/{account_id}", response_model=AccountResponse)
async def get_account(
    account_id: int,
    workspace: WorkspaceContext = Depends(get_current_workspace_context),
):
    """Получить счёт по ID."""
    async with AccountService() as service:
        return await service.get_by_id(
            account_id=account_id,
            workspace_id=workspace.workspace_id,
        )


@router.post("", response_model=AccountResponse, status_code=201)
async def create_account(
    data: AccountCreate,
    workspace: WorkspaceContext = Depends(get_current_workspace_context),
):
    """Создать новый счёт."""
    async with AccountService() as service:
        return await service.create(
            workspace_id=workspace.workspace_id,
            actor_user_id=workspace.user.id,
            data=data,
        )


@router.patch("/{account_id}", response_model=AccountResponse)
async def update_account(
    account_id: int,
    data: AccountUpdate,
    workspace: WorkspaceContext = Depends(get_current_workspace_context),
):
    """Обновить счёт."""
    async with AccountService() as service:
        return await service.update(
            account_id=account_id,
            workspace_id=workspace.workspace_id,
            data=data,
        )


@router.delete("/{account_id}", status_code=204)
async def delete_account(
    account_id: int,
    workspace: WorkspaceContext = Depends(get_current_workspace_context),
):
    """Удалить счёт."""
    async with AccountService() as service:
        await service.delete(
            account_id=account_id,
            workspace_id=workspace.workspace_id,
        )
