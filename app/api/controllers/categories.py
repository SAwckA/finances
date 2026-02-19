from fastapi import APIRouter, Depends, Query

from app.api.dependencies.auth import (
    WorkspaceContext,
    get_current_workspace_context,
)
from app.models.category import (
    CategoryCreate,
    CategoryResponse,
    CategoryType,
    CategoryUpdate,
)
from app.services.category_service import CategoryService

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("", response_model=list[CategoryResponse])
async def get_categories(
    category_type: CategoryType | None = Query(None, description="Фильтр по типу"),
    skip: int = 0,
    limit: int = 100,
    workspace: WorkspaceContext = Depends(get_current_workspace_context),
):
    """Получить категории активного workspace."""
    async with CategoryService() as service:
        return await service.get_workspace_categories(
            workspace_id=workspace.workspace_id,
            category_type=category_type,
            skip=skip,
            limit=limit,
        )


@router.get("/{category_id}", response_model=CategoryResponse)
async def get_category(
    category_id: int,
    workspace: WorkspaceContext = Depends(get_current_workspace_context),
):
    """Получить категорию по ID."""
    async with CategoryService() as service:
        return await service.get_by_id(
            category_id=category_id,
            workspace_id=workspace.workspace_id,
        )


@router.post("", response_model=CategoryResponse, status_code=201)
async def create_category(
    data: CategoryCreate,
    workspace: WorkspaceContext = Depends(get_current_workspace_context),
):
    """Создать новую категорию."""
    async with CategoryService() as service:
        return await service.create(
            workspace_id=workspace.workspace_id,
            actor_user_id=workspace.user.id,
            data=data,
        )


@router.patch("/{category_id}", response_model=CategoryResponse)
async def update_category(
    category_id: int,
    data: CategoryUpdate,
    workspace: WorkspaceContext = Depends(get_current_workspace_context),
):
    """Обновить категорию."""
    async with CategoryService() as service:
        return await service.update(
            category_id=category_id,
            workspace_id=workspace.workspace_id,
            data=data,
        )


@router.delete("/{category_id}", status_code=204)
async def delete_category(
    category_id: int,
    workspace: WorkspaceContext = Depends(get_current_workspace_context),
):
    """Удалить категорию."""
    async with CategoryService() as service:
        await service.delete(
            category_id=category_id,
            workspace_id=workspace.workspace_id,
        )
