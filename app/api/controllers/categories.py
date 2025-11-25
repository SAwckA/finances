from fastapi import APIRouter, Depends, Query

from app.api.dependencies.auth import get_current_active_user
from app.models.category import (
    CategoryCreate,
    CategoryResponse,
    CategoryType,
    CategoryUpdate,
)
from app.models.user import User
from app.services.category_service import CategoryService

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("", response_model=list[CategoryResponse])
async def get_categories(
    category_type: CategoryType | None = Query(None, description="Фильтр по типу"),
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_active_user),
):
    """Получить все категории текущего пользователя."""
    async with CategoryService() as service:
        return await service.get_user_categories(
            user_id=current_user.id,
            category_type=category_type,
            skip=skip,
            limit=limit,
        )


@router.get("/{category_id}", response_model=CategoryResponse)
async def get_category(
    category_id: int,
    current_user: User = Depends(get_current_active_user),
):
    """Получить категорию по ID."""
    async with CategoryService() as service:
        return await service.get_by_id(category_id=category_id, user_id=current_user.id)


@router.post("", response_model=CategoryResponse, status_code=201)
async def create_category(
    data: CategoryCreate,
    current_user: User = Depends(get_current_active_user),
):
    """Создать новую категорию."""
    async with CategoryService() as service:
        return await service.create(user_id=current_user.id, data=data)


@router.patch("/{category_id}", response_model=CategoryResponse)
async def update_category(
    category_id: int,
    data: CategoryUpdate,
    current_user: User = Depends(get_current_active_user),
):
    """Обновить категорию."""
    async with CategoryService() as service:
        return await service.update(
            category_id=category_id, user_id=current_user.id, data=data
        )


@router.delete("/{category_id}", status_code=204)
async def delete_category(
    category_id: int,
    current_user: User = Depends(get_current_active_user),
):
    """Удалить категорию."""
    async with CategoryService() as service:
        await service.delete(category_id=category_id, user_id=current_user.id)
