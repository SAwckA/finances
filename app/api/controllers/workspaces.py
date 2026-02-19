from fastapi import APIRouter, Depends

from app.api.dependencies.auth import get_current_active_user
from app.models.user import User
from app.models.workspace import (
    AddWorkspaceMemberRequest,
    TransferWorkspaceOwnershipRequest,
    WorkspaceCreate,
    WorkspaceMemberResponse,
    WorkspaceResponse,
    WorkspaceUpdate,
)
from app.services.workspace_service import WorkspaceService

router = APIRouter(prefix="/workspaces", tags=["workspaces"])


@router.get("", response_model=list[WorkspaceResponse])
async def get_workspaces(current_user: User = Depends(get_current_active_user)):
    """Получить все workspace пользователя."""
    async with WorkspaceService() as service:
        return await service.get_user_workspaces(current_user.id)


@router.post("", response_model=WorkspaceResponse, status_code=201)
async def create_workspace(
    data: WorkspaceCreate,
    current_user: User = Depends(get_current_active_user),
):
    """Создать shared workspace."""
    async with WorkspaceService() as service:
        return await service.create_shared_workspace(current_user.id, data)


@router.patch("/{workspace_id}", response_model=WorkspaceResponse)
async def rename_workspace(
    workspace_id: int,
    data: WorkspaceUpdate,
    current_user: User = Depends(get_current_active_user),
):
    """Переименовать workspace (owner-only)."""
    async with WorkspaceService() as service:
        return await service.rename_workspace(workspace_id, current_user.id, data)


@router.delete("/{workspace_id}", status_code=204)
async def delete_workspace(
    workspace_id: int,
    current_user: User = Depends(get_current_active_user),
):
    """Удалить shared workspace (owner-only, soft-delete)."""
    async with WorkspaceService() as service:
        await service.delete_workspace(workspace_id, current_user.id)


@router.get("/{workspace_id}/members", response_model=list[WorkspaceMemberResponse])
async def list_workspace_members(
    workspace_id: int,
    current_user: User = Depends(get_current_active_user),
):
    """Список участников workspace."""
    async with WorkspaceService() as service:
        return await service.list_members(workspace_id, current_user.id)


@router.post(
    "/{workspace_id}/members", response_model=WorkspaceMemberResponse, status_code=201
)
async def add_workspace_member(
    workspace_id: int,
    data: AddWorkspaceMemberRequest,
    current_user: User = Depends(get_current_active_user),
):
    """Добавить участника по email (owner-only)."""
    async with WorkspaceService() as service:
        return await service.add_member_by_email(
            workspace_id=workspace_id,
            actor_user_id=current_user.id,
            email=data.email,
        )


@router.delete("/{workspace_id}/members/{user_id}", status_code=204)
async def remove_workspace_member(
    workspace_id: int,
    user_id: int,
    current_user: User = Depends(get_current_active_user),
):
    """Удалить участника из workspace (owner-only)."""
    async with WorkspaceService() as service:
        await service.remove_member(
            workspace_id=workspace_id,
            actor_user_id=current_user.id,
            member_user_id=user_id,
        )


@router.post("/{workspace_id}/transfer-ownership", response_model=WorkspaceResponse)
async def transfer_workspace_ownership(
    workspace_id: int,
    data: TransferWorkspaceOwnershipRequest,
    current_user: User = Depends(get_current_active_user),
):
    """Передать владение workspace другому участнику (owner-only)."""
    async with WorkspaceService() as service:
        return await service.transfer_ownership(
            workspace_id=workspace_id,
            actor_user_id=current_user.id,
            new_owner_user_id=data.new_owner_user_id,
        )


@router.post("/{workspace_id}/leave", status_code=204)
async def leave_workspace(
    workspace_id: int,
    current_user: User = Depends(get_current_active_user),
):
    """Выйти из workspace (owner сначала передаёт права)."""
    async with WorkspaceService() as service:
        await service.leave_workspace(
            workspace_id=workspace_id, actor_user_id=current_user.id
        )
