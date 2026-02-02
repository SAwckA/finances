from fastapi import APIRouter, Depends

from app.api.dependencies.auth import get_current_active_user
from app.models.account import AccountCreate, AccountResponse, AccountUpdate
from app.models.user import User
from app.services.account_service import AccountService

router = APIRouter(prefix="/accounts", tags=["accounts"])


@router.get("", response_model=list[AccountResponse])
async def get_accounts(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_active_user),
):
    """Получить все счета текущего пользователя."""
    async with AccountService() as service:
        return await service.get_user_accounts(
            user_id=current_user.id, skip=skip, limit=limit
        )


@router.get("/{account_id}", response_model=AccountResponse)
async def get_account(
    account_id: int,
    current_user: User = Depends(get_current_active_user),
):
    """Получить счёт по ID."""
    async with AccountService() as service:
        return await service.get_by_id(account_id=account_id, user_id=current_user.id)


@router.post("", response_model=AccountResponse, status_code=201)
async def create_account(
    data: AccountCreate,
    current_user: User = Depends(get_current_active_user),
):
    """Создать новый счёт."""
    async with AccountService() as service:
        return await service.create(user_id=current_user.id, data=data)


@router.patch("/{account_id}", response_model=AccountResponse)
async def update_account(
    account_id: int,
    data: AccountUpdate,
    current_user: User = Depends(get_current_active_user),
):
    """Обновить счёт."""
    async with AccountService() as service:
        return await service.update(
            account_id=account_id, user_id=current_user.id, data=data
        )


@router.delete("/{account_id}", status_code=204)
async def delete_account(
    account_id: int,
    current_user: User = Depends(get_current_active_user),
):
    """Удалить счёт."""
    async with AccountService() as service:
        await service.delete(account_id=account_id, user_id=current_user.id)
