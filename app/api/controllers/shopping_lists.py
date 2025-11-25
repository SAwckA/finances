from fastapi import APIRouter, Depends, Query

from app.api.dependencies.auth import get_current_active_user
from app.models.shopping_list import (
    ShoppingItemCreate,
    ShoppingItemResponse,
    ShoppingItemUpdate,
    ShoppingListCreate,
    ShoppingListResponse,
    ShoppingListStatus,
    ShoppingListUpdate,
)
from app.models.user import User
from app.services.shopping_list_service import ShoppingListService

router = APIRouter(prefix="/shopping-lists", tags=["shopping-lists"])


@router.get("", response_model=list[ShoppingListResponse])
async def get_shopping_lists(
    status: ShoppingListStatus | None = Query(None, description="Фильтр по статусу"),
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_active_user),
):
    """Получить все списки покупок пользователя."""
    async with ShoppingListService() as service:
        return await service.get_user_lists(
            user_id=current_user.id, status=status, skip=skip, limit=limit
        )


@router.get("/{list_id}", response_model=ShoppingListResponse)
async def get_shopping_list(
    list_id: int,
    current_user: User = Depends(get_current_active_user),
):
    """Получить список покупок по ID."""
    async with ShoppingListService() as service:
        return await service.get_by_id(list_id=list_id, user_id=current_user.id)


@router.post("", response_model=ShoppingListResponse, status_code=201)
async def create_shopping_list(
    data: ShoppingListCreate,
    current_user: User = Depends(get_current_active_user),
):
    """Создать новый список покупок."""
    async with ShoppingListService() as service:
        return await service.create(user_id=current_user.id, data=data)


@router.patch("/{list_id}", response_model=ShoppingListResponse)
async def update_shopping_list(
    list_id: int,
    data: ShoppingListUpdate,
    current_user: User = Depends(get_current_active_user),
):
    """Обновить список покупок."""
    async with ShoppingListService() as service:
        return await service.update(
            list_id=list_id, user_id=current_user.id, data=data
        )


@router.delete("/{list_id}", status_code=204)
async def delete_shopping_list(
    list_id: int,
    current_user: User = Depends(get_current_active_user),
):
    """Удалить список покупок."""
    async with ShoppingListService() as service:
        await service.delete(list_id=list_id, user_id=current_user.id)


@router.post("/{list_id}/items", response_model=ShoppingItemResponse, status_code=201)
async def add_item(
    list_id: int,
    data: ShoppingItemCreate,
    current_user: User = Depends(get_current_active_user),
):
    """Добавить товар в список."""
    async with ShoppingListService() as service:
        return await service.add_item(
            list_id=list_id, user_id=current_user.id, data=data
        )


@router.patch("/{list_id}/items/{item_id}", response_model=ShoppingItemResponse)
async def update_item(
    list_id: int,
    item_id: int,
    data: ShoppingItemUpdate,
    current_user: User = Depends(get_current_active_user),
):
    """Обновить товар в списке."""
    async with ShoppingListService() as service:
        return await service.update_item(
            list_id=list_id, item_id=item_id, user_id=current_user.id, data=data
        )


@router.delete("/{list_id}/items/{item_id}", status_code=204)
async def remove_item(
    list_id: int,
    item_id: int,
    current_user: User = Depends(get_current_active_user),
):
    """Удалить товар из списка."""
    async with ShoppingListService() as service:
        await service.remove_item(
            list_id=list_id, item_id=item_id, user_id=current_user.id
        )


@router.post("/{list_id}/confirm", response_model=ShoppingListResponse)
async def confirm_shopping_list(
    list_id: int,
    current_user: User = Depends(get_current_active_user),
):
    """Подтвердить список покупок."""
    async with ShoppingListService() as service:
        return await service.confirm(list_id=list_id, user_id=current_user.id)


@router.post("/{list_id}/complete", response_model=ShoppingListResponse)
async def complete_shopping_list(
    list_id: int,
    current_user: User = Depends(get_current_active_user),
):
    """
    Завершить список покупок и создать транзакцию.

    Требования:
    - Список должен быть подтверждён
    - Все товары должны иметь указанную цену
    """
    async with ShoppingListService() as service:
        return await service.complete(list_id=list_id, user_id=current_user.id)

