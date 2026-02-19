from fastapi import APIRouter, Depends, Query

from app.api.dependencies.auth import (
    WorkspaceContext,
    get_current_workspace_context,
)
from app.models.shopping_list import (
    ShoppingItemCreate,
    ShoppingItemResponse,
    ShoppingItemUpdate,
    ShoppingListCreate,
    ShoppingListResponse,
    ShoppingListStatus,
    ShoppingListUpdate,
)
from app.services.shopping_list_service import ShoppingListService

router = APIRouter(prefix="/shopping-lists", tags=["shopping-lists"])


@router.get("", response_model=list[ShoppingListResponse])
async def get_shopping_lists(
    status: ShoppingListStatus | None = Query(None, description="Фильтр по статусу"),
    skip: int = 0,
    limit: int = 100,
    workspace: WorkspaceContext = Depends(get_current_workspace_context),
):
    """Получить списки покупок активного workspace."""
    async with ShoppingListService() as service:
        return await service.get_workspace_lists(
            workspace_id=workspace.workspace_id,
            status=status,
            skip=skip,
            limit=limit,
        )


@router.get("/{list_id}", response_model=ShoppingListResponse)
async def get_shopping_list(
    list_id: int,
    workspace: WorkspaceContext = Depends(get_current_workspace_context),
):
    """Получить список покупок по ID."""
    async with ShoppingListService() as service:
        return await service.get_by_id(
            list_id=list_id,
            workspace_id=workspace.workspace_id,
        )


@router.post("", response_model=ShoppingListResponse, status_code=201)
async def create_shopping_list(
    data: ShoppingListCreate,
    workspace: WorkspaceContext = Depends(get_current_workspace_context),
):
    """Создать новый список покупок."""
    async with ShoppingListService() as service:
        return await service.create(
            workspace_id=workspace.workspace_id,
            actor_user_id=workspace.user.id,
            data=data,
        )


@router.patch("/{list_id}", response_model=ShoppingListResponse)
async def update_shopping_list(
    list_id: int,
    data: ShoppingListUpdate,
    workspace: WorkspaceContext = Depends(get_current_workspace_context),
):
    """Обновить список покупок."""
    async with ShoppingListService() as service:
        return await service.update(
            list_id=list_id,
            workspace_id=workspace.workspace_id,
            data=data,
        )


@router.delete("/{list_id}", status_code=204)
async def delete_shopping_list(
    list_id: int,
    workspace: WorkspaceContext = Depends(get_current_workspace_context),
):
    """Удалить список покупок."""
    async with ShoppingListService() as service:
        await service.delete(
            list_id=list_id,
            workspace_id=workspace.workspace_id,
        )


@router.post("/{list_id}/items", response_model=ShoppingItemResponse, status_code=201)
async def add_item(
    list_id: int,
    data: ShoppingItemCreate,
    workspace: WorkspaceContext = Depends(get_current_workspace_context),
):
    """Добавить товар в список."""
    async with ShoppingListService() as service:
        return await service.add_item(
            list_id=list_id,
            workspace_id=workspace.workspace_id,
            data=data,
        )


@router.patch("/{list_id}/items/{item_id}", response_model=ShoppingItemResponse)
async def update_item(
    list_id: int,
    item_id: int,
    data: ShoppingItemUpdate,
    workspace: WorkspaceContext = Depends(get_current_workspace_context),
):
    """Обновить товар в списке."""
    async with ShoppingListService() as service:
        return await service.update_item(
            list_id=list_id,
            item_id=item_id,
            workspace_id=workspace.workspace_id,
            data=data,
        )


@router.delete("/{list_id}/items/{item_id}", status_code=204)
async def remove_item(
    list_id: int,
    item_id: int,
    workspace: WorkspaceContext = Depends(get_current_workspace_context),
):
    """Удалить товар из списка."""
    async with ShoppingListService() as service:
        await service.remove_item(
            list_id=list_id,
            item_id=item_id,
            workspace_id=workspace.workspace_id,
        )


@router.post("/{list_id}/confirm", response_model=ShoppingListResponse)
async def confirm_shopping_list(
    list_id: int,
    workspace: WorkspaceContext = Depends(get_current_workspace_context),
):
    """Подтвердить список покупок."""
    async with ShoppingListService() as service:
        return await service.confirm(
            list_id=list_id,
            workspace_id=workspace.workspace_id,
        )


@router.post("/{list_id}/draft", response_model=ShoppingListResponse)
async def revert_shopping_list_to_draft(
    list_id: int,
    workspace: WorkspaceContext = Depends(get_current_workspace_context),
):
    """Вернуть список покупок в черновик."""
    async with ShoppingListService() as service:
        return await service.revert_to_draft(
            list_id=list_id,
            workspace_id=workspace.workspace_id,
        )


@router.post("/{list_id}/complete", response_model=ShoppingListResponse)
async def complete_shopping_list(
    list_id: int,
    workspace: WorkspaceContext = Depends(get_current_workspace_context),
):
    """
    Завершить список покупок и создать транзакцию.

    Требования:
    - Список должен быть подтверждён
    - Все товары должны иметь указанную цену
    """
    async with ShoppingListService() as service:
        return await service.complete(
            list_id=list_id,
            workspace_id=workspace.workspace_id,
            actor_user_id=workspace.user.id,
        )
