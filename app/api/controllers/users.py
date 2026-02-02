from fastapi import APIRouter, Depends, Query

from app.api.dependencies.auth import get_current_active_user
from app.models.user import User, UserResponse, UserUpdate
from app.services.user_service import UserService

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_active_user)):
    """Получение текущего пользователя."""
    return current_user


@router.put("/me", response_model=UserResponse)
async def update_me(
    data: UserUpdate,
    current_user: User = Depends(get_current_active_user),
):
    """Обновление текущего пользователя."""
    async with UserService() as service:
        return await service.update_user(current_user.id, data)


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(user_id: int):
    """Получение пользователя по ID."""
    async with UserService() as service:
        return await service.get_user_by_id(user_id)


@router.get("", response_model=list[UserResponse])
async def get_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
):
    """Получение списка пользователей."""
    async with UserService() as service:
        return await service.get_users(skip=skip, limit=limit)


@router.delete("/{user_id}", status_code=204)
async def delete_user(
    user_id: int,
    current_user: User = Depends(get_current_active_user),
):
    """Удаление пользователя."""
    async with UserService() as service:
        await service.delete_user(user_id)
