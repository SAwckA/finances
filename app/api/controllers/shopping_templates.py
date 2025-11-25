from fastapi import APIRouter, Depends, Query

from app.api.dependencies.auth import get_current_active_user
from app.models.shopping_list import ShoppingListResponse
from app.models.shopping_template import (
    ShoppingTemplateCreate,
    ShoppingTemplateItemCreate,
    ShoppingTemplateItemResponse,
    ShoppingTemplateItemUpdate,
    ShoppingTemplateResponse,
    ShoppingTemplateUpdate,
)
from app.models.user import User
from app.services.shopping_template_service import ShoppingTemplateService

router = APIRouter(prefix="/shopping-templates", tags=["shopping-templates"])


@router.get("", response_model=list[ShoppingTemplateResponse])
async def get_templates(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_active_user),
):
    """Получить все шаблоны списков покупок пользователя."""
    async with ShoppingTemplateService() as service:
        return await service.get_user_templates(
            user_id=current_user.id, skip=skip, limit=limit
        )


@router.get("/{template_id}", response_model=ShoppingTemplateResponse)
async def get_template(
    template_id: int,
    current_user: User = Depends(get_current_active_user),
):
    """Получить шаблон по ID."""
    async with ShoppingTemplateService() as service:
        return await service.get_by_id(template_id=template_id, user_id=current_user.id)


@router.post("", response_model=ShoppingTemplateResponse, status_code=201)
async def create_template(
    data: ShoppingTemplateCreate,
    current_user: User = Depends(get_current_active_user),
):
    """Создать новый шаблон."""
    async with ShoppingTemplateService() as service:
        return await service.create(user_id=current_user.id, data=data)


@router.patch("/{template_id}", response_model=ShoppingTemplateResponse)
async def update_template(
    template_id: int,
    data: ShoppingTemplateUpdate,
    current_user: User = Depends(get_current_active_user),
):
    """Обновить шаблон."""
    async with ShoppingTemplateService() as service:
        return await service.update(
            template_id=template_id, user_id=current_user.id, data=data
        )


@router.delete("/{template_id}", status_code=204)
async def delete_template(
    template_id: int,
    current_user: User = Depends(get_current_active_user),
):
    """Удалить шаблон."""
    async with ShoppingTemplateService() as service:
        await service.delete(template_id=template_id, user_id=current_user.id)


@router.post(
    "/{template_id}/items", response_model=ShoppingTemplateItemResponse, status_code=201
)
async def add_template_item(
    template_id: int,
    data: ShoppingTemplateItemCreate,
    current_user: User = Depends(get_current_active_user),
):
    """Добавить товар в шаблон."""
    async with ShoppingTemplateService() as service:
        return await service.add_item(
            template_id=template_id, user_id=current_user.id, data=data
        )


@router.patch(
    "/{template_id}/items/{item_id}", response_model=ShoppingTemplateItemResponse
)
async def update_template_item(
    template_id: int,
    item_id: int,
    data: ShoppingTemplateItemUpdate,
    current_user: User = Depends(get_current_active_user),
):
    """Обновить товар в шаблоне."""
    async with ShoppingTemplateService() as service:
        return await service.update_item(
            template_id=template_id,
            item_id=item_id,
            user_id=current_user.id,
            data=data,
        )


@router.delete("/{template_id}/items/{item_id}", status_code=204)
async def remove_template_item(
    template_id: int,
    item_id: int,
    current_user: User = Depends(get_current_active_user),
):
    """Удалить товар из шаблона."""
    async with ShoppingTemplateService() as service:
        await service.remove_item(
            template_id=template_id, item_id=item_id, user_id=current_user.id
        )


@router.post("/{template_id}/create-list", response_model=ShoppingListResponse)
async def create_list_from_template(
    template_id: int,
    name: str | None = Query(None, description="Название списка"),
    account_id: int | None = Query(None, description="ID счёта"),
    category_id: int | None = Query(None, description="ID категории"),
    current_user: User = Depends(get_current_active_user),
):
    """
    Создать список покупок из шаблона.

    Если не указаны account_id и category_id, используются значения из шаблона.
    """
    async with ShoppingTemplateService() as service:
        return await service.create_list_from_template(
            template_id=template_id,
            user_id=current_user.id,
            name=name,
            account_id=account_id,
            category_id=category_id,
        )

