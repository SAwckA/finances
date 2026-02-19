from typing import Sequence

from sqlalchemy import case, delete, func, select

from app.models.user import User
from app.models.workspace import (
    Workspace,
    WorkspaceKind,
    WorkspaceMembership,
)
from app.repositories.base_repository import BaseRepository


class WorkspaceRepository(BaseRepository[Workspace]):
    """Репозиторий для рабочих пространств."""

    async def get_personal_workspace(self, user_id: int) -> Workspace | None:
        """Получить персональный workspace пользователя."""
        return await self.get_by(personal_for_user_id=user_id)

    async def get_user_workspace(
        self,
        user_id: int,
        workspace_id: int,
    ) -> Workspace | None:
        """Получить workspace только если пользователь является участником."""
        query = (
            self._base_query()
            .join(
                WorkspaceMembership,
                WorkspaceMembership.workspace_id == Workspace.id,
            )
            .where(Workspace.id == workspace_id)
            .where(WorkspaceMembership.user_id == user_id)
        )
        result = await self.session.execute(query)
        return result.scalar_one_or_none()

    async def list_user_workspaces(self, user_id: int) -> Sequence[Workspace]:
        """Список доступных пользователю workspace."""
        query = (
            self._base_query()
            .join(
                WorkspaceMembership,
                WorkspaceMembership.workspace_id == Workspace.id,
            )
            .where(WorkspaceMembership.user_id == user_id)
            .order_by(
                case((Workspace.kind == WorkspaceKind.PERSONAL, 0), else_=1),
                Workspace.created_at,
            )
        )
        result = await self.session.execute(query)
        return result.scalars().all()

    async def count_shared_owned(self, owner_user_id: int) -> int:
        """Количество shared workspace, созданных пользователем."""
        query = (
            select(func.count())
            .select_from(Workspace)
            .where(Workspace.deleted_at.is_(None))
            .where(Workspace.owner_user_id == owner_user_id)
            .where(Workspace.kind == WorkspaceKind.SHARED)
        )
        result = await self.session.execute(query)
        return int(result.scalar_one())


class WorkspaceMembershipRepository(BaseRepository[WorkspaceMembership]):
    """Репозиторий membership в рабочих пространствах."""

    async def get_membership(
        self,
        workspace_id: int,
        user_id: int,
    ) -> WorkspaceMembership | None:
        """Получить membership пользователя в workspace."""
        return await self.get_by(workspace_id=workspace_id, user_id=user_id)

    async def list_workspace_members(
        self,
        workspace_id: int,
    ) -> Sequence[WorkspaceMembership]:
        """Получить membership-строки workspace."""
        query = (
            self._base_query()
            .where(WorkspaceMembership.workspace_id == workspace_id)
            .order_by(WorkspaceMembership.created_at)
        )
        result = await self.session.execute(query)
        return result.scalars().all()

    async def list_workspace_members_with_users(
        self,
        workspace_id: int,
    ) -> Sequence[tuple[WorkspaceMembership, User]]:
        """Получить участников workspace вместе с пользователями."""
        query = (
            select(WorkspaceMembership, User)
            .join(User, User.id == WorkspaceMembership.user_id)
            .where(WorkspaceMembership.workspace_id == workspace_id)
            .where(User.deleted_at.is_(None))
            .order_by(WorkspaceMembership.created_at)
        )
        result = await self.session.execute(query)
        return result.all()

    async def delete_membership(self, workspace_id: int, user_id: int) -> bool:
        """Удалить membership пользователя в workspace."""
        query = delete(WorkspaceMembership).where(
            WorkspaceMembership.workspace_id == workspace_id,
            WorkspaceMembership.user_id == user_id,
        )
        result = await self.session.execute(query)
        return result.rowcount > 0  # type: ignore[union-attr]
