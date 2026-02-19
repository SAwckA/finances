import logging

from app.exceptions import (
    BusinessLogicException,
    ConflictException,
    ForbiddenException,
    NotFoundException,
    ValidationException,
)
from app.models.workspace import (
    Workspace,
    WorkspaceCreate,
    WorkspaceKind,
    WorkspaceMemberResponse,
    WorkspaceMembership,
    WorkspaceRole,
    WorkspaceUpdate,
)
from app.repositories.user_repository import UserRepository
from app.repositories.workspace_repository import (
    WorkspaceMembershipRepository,
    WorkspaceRepository,
)
from app.services.base_service import BaseService

logger = logging.getLogger(__name__)


class WorkspaceNotFoundException(NotFoundException):
    message = "Рабочее пространство не найдено"


class WorkspaceAccessDeniedException(ForbiddenException):
    message = "Нет доступа к рабочему пространству"


class SharedWorkspaceLimitExceededException(ConflictException):
    message = "Лимит shared workspace исчерпан"


class WorkspaceMemberAlreadyExistsException(ConflictException):
    message = "Пользователь уже состоит в рабочем пространстве"


class WorkspaceMemberNotFoundException(NotFoundException):
    message = "Участник рабочего пространства не найден"


class WorkspaceUserNotFoundException(NotFoundException):
    message = "Пользователь с таким email не найден"


class WorkspaceOwnerRequiredException(ForbiddenException):
    message = "Операция доступна только владельцу рабочего пространства"


class WorkspaceInvalidOperationException(BusinessLogicException):
    message = "Операция невозможна для данного рабочего пространства"


class WorkspaceOwnerCannotLeaveException(ValidationException):
    message = "Передайте права владельца перед выходом из workspace"


class WorkspaceService(BaseService):
    """Сервис для управления рабочими пространствами и участниками."""

    workspace_repository: WorkspaceRepository
    membership_repository: WorkspaceMembershipRepository
    user_repository: UserRepository

    async def resolve_personal_workspace(self, user_id: int) -> Workspace:
        """Получить или создать персональный workspace пользователя."""
        workspace = await self.workspace_repository.get_personal_workspace(user_id)
        if not workspace:
            workspace = await self.workspace_repository.create(
                {
                    "name": "Личное пространство",
                    "kind": WorkspaceKind.PERSONAL,
                    "owner_user_id": user_id,
                    "personal_for_user_id": user_id,
                }
            )

        membership = await self.membership_repository.get_membership(
            workspace.id, user_id
        )
        if not membership:
            await self.membership_repository.create(
                {
                    "workspace_id": workspace.id,
                    "user_id": user_id,
                    "role": WorkspaceRole.OWNER,
                }
            )

        return workspace

    async def resolve_workspace_for_user(
        self,
        user_id: int,
        requested_workspace_id: int | None,
    ) -> tuple[Workspace, WorkspaceMembership]:
        """Разрешить активный workspace пользователя с проверкой membership."""
        if requested_workspace_id is None:
            workspace = await self.resolve_personal_workspace(user_id)
        else:
            workspace = await self.workspace_repository.get_user_workspace(
                user_id=user_id,
                workspace_id=requested_workspace_id,
            )
            if not workspace:
                raise WorkspaceAccessDeniedException(
                    details={"workspace_id": requested_workspace_id}
                )

        membership = await self.membership_repository.get_membership(
            workspace_id=workspace.id,
            user_id=user_id,
        )
        if not membership:
            raise WorkspaceAccessDeniedException(details={"workspace_id": workspace.id})

        return workspace, membership

    async def get_user_workspaces(self, user_id: int) -> list[Workspace]:
        """Список workspace, доступных пользователю."""
        await self.resolve_personal_workspace(user_id)
        workspaces = await self.workspace_repository.list_user_workspaces(user_id)
        return list(workspaces)

    async def create_shared_workspace(
        self,
        owner_user_id: int,
        data: WorkspaceCreate,
    ) -> Workspace:
        """Создать shared workspace с лимитом 1 на владельца."""
        shared_count = await self.workspace_repository.count_shared_owned(owner_user_id)
        if shared_count >= 1:
            raise SharedWorkspaceLimitExceededException(
                details={"owner_user_id": owner_user_id, "limit": 1}
            )

        workspace = await self.workspace_repository.create(
            {
                "name": data.name.strip(),
                "kind": WorkspaceKind.SHARED,
                "owner_user_id": owner_user_id,
                "personal_for_user_id": None,
            }
        )
        await self.membership_repository.create(
            {
                "workspace_id": workspace.id,
                "user_id": owner_user_id,
                "role": WorkspaceRole.OWNER,
            }
        )

        logger.info(
            "Created shared workspace id=%s owner=%s", workspace.id, owner_user_id
        )
        return workspace

    async def rename_workspace(
        self,
        workspace_id: int,
        actor_user_id: int,
        data: WorkspaceUpdate,
    ) -> Workspace:
        """Переименовать workspace (owner-only)."""
        workspace, membership = await self.resolve_workspace_for_user(
            user_id=actor_user_id,
            requested_workspace_id=workspace_id,
        )
        self._ensure_owner_membership(membership)

        updated = await self.workspace_repository.update(
            workspace.id,
            {"name": data.name.strip()},
        )
        return updated or workspace

    async def delete_workspace(self, workspace_id: int, actor_user_id: int) -> bool:
        """Soft-delete shared workspace (owner-only)."""
        workspace, membership = await self.resolve_workspace_for_user(
            user_id=actor_user_id,
            requested_workspace_id=workspace_id,
        )
        self._ensure_owner_membership(membership)
        self._ensure_shared_workspace(workspace)

        result = await self.workspace_repository.delete(workspace.id)
        logger.info("Deleted workspace id=%s by user=%s", workspace.id, actor_user_id)
        return result

    async def list_members(
        self,
        workspace_id: int,
        actor_user_id: int,
    ) -> list[WorkspaceMemberResponse]:
        """Получить список участников workspace."""
        workspace, _ = await self.resolve_workspace_for_user(
            user_id=actor_user_id,
            requested_workspace_id=workspace_id,
        )

        rows = await self.membership_repository.list_workspace_members_with_users(
            workspace.id
        )
        return [
            WorkspaceMemberResponse(
                user_id=user.id,
                email=user.email,
                name=user.name,
                role=membership.role,
                joined_at=membership.created_at,
            )
            for membership, user in rows
        ]

    async def add_member_by_email(
        self,
        workspace_id: int,
        actor_user_id: int,
        email: str,
    ) -> WorkspaceMemberResponse:
        """Добавить пользователя в shared workspace по email (auto-add)."""
        workspace, membership = await self.resolve_workspace_for_user(
            user_id=actor_user_id,
            requested_workspace_id=workspace_id,
        )
        self._ensure_owner_membership(membership)
        self._ensure_shared_workspace(workspace)

        normalized_email = email.strip().lower()
        user = await self.user_repository.get_by_email(normalized_email)
        if not user:
            raise WorkspaceUserNotFoundException(details={"email": normalized_email})

        existing = await self.membership_repository.get_membership(
            workspace.id, user.id
        )
        if existing:
            raise WorkspaceMemberAlreadyExistsException(
                details={"workspace_id": workspace.id, "user_id": user.id}
            )

        created = await self.membership_repository.create(
            {
                "workspace_id": workspace.id,
                "user_id": user.id,
                "role": WorkspaceRole.EDITOR,
            }
        )
        logger.info(
            "Added member user=%s to workspace=%s by owner=%s",
            user.id,
            workspace.id,
            actor_user_id,
        )

        return WorkspaceMemberResponse(
            user_id=user.id,
            email=user.email,
            name=user.name,
            role=created.role,
            joined_at=created.created_at,
        )

    async def remove_member(
        self,
        workspace_id: int,
        actor_user_id: int,
        member_user_id: int,
    ) -> bool:
        """Удалить участника из shared workspace (owner-only)."""
        workspace, membership = await self.resolve_workspace_for_user(
            user_id=actor_user_id,
            requested_workspace_id=workspace_id,
        )
        self._ensure_owner_membership(membership)
        self._ensure_shared_workspace(workspace)

        member = await self.membership_repository.get_membership(
            workspace.id, member_user_id
        )
        if not member:
            raise WorkspaceMemberNotFoundException(
                details={"workspace_id": workspace.id, "user_id": member_user_id}
            )
        if member.role == WorkspaceRole.OWNER:
            raise WorkspaceInvalidOperationException(
                message="Нельзя удалить владельца рабочего пространства"
            )

        result = await self.membership_repository.delete_membership(
            workspace_id=workspace.id,
            user_id=member_user_id,
        )
        return result

    async def transfer_ownership(
        self,
        workspace_id: int,
        actor_user_id: int,
        new_owner_user_id: int,
    ) -> Workspace:
        """Передать ownership другому участнику shared workspace."""
        workspace, actor_membership = await self.resolve_workspace_for_user(
            user_id=actor_user_id,
            requested_workspace_id=workspace_id,
        )
        self._ensure_owner_membership(actor_membership)
        self._ensure_shared_workspace(workspace)

        if new_owner_user_id == actor_user_id:
            raise WorkspaceInvalidOperationException(
                message="Текущий владелец уже является owner"
            )

        next_owner_membership = await self.membership_repository.get_membership(
            workspace.id,
            new_owner_user_id,
        )
        if not next_owner_membership:
            raise WorkspaceInvalidOperationException(
                message="Новый владелец должен быть участником workspace"
            )

        await self.workspace_repository.update(
            workspace.id,
            {"owner_user_id": new_owner_user_id},
        )
        await self.membership_repository.update(
            next_owner_membership.id,
            {"role": WorkspaceRole.OWNER},
        )
        await self.membership_repository.update(
            actor_membership.id,
            {"role": WorkspaceRole.EDITOR},
        )

        updated = await self.workspace_repository.get_by_id(workspace.id)
        if not updated:
            raise WorkspaceNotFoundException(details={"workspace_id": workspace.id})
        return updated

    async def leave_workspace(
        self,
        workspace_id: int,
        actor_user_id: int,
    ) -> bool:
        """Выйти из shared workspace (owner выйти не может)."""
        workspace, membership = await self.resolve_workspace_for_user(
            user_id=actor_user_id,
            requested_workspace_id=workspace_id,
        )
        self._ensure_shared_workspace(workspace)

        if membership.role == WorkspaceRole.OWNER:
            raise WorkspaceOwnerCannotLeaveException()

        result = await self.membership_repository.delete_membership(
            workspace_id=workspace.id,
            user_id=actor_user_id,
        )
        return result

    @staticmethod
    def _ensure_owner_membership(membership: WorkspaceMembership) -> None:
        if membership.role != WorkspaceRole.OWNER:
            raise WorkspaceOwnerRequiredException()

    @staticmethod
    def _ensure_shared_workspace(workspace: Workspace) -> None:
        if workspace.kind != WorkspaceKind.SHARED:
            raise WorkspaceInvalidOperationException(
                message="Операция доступна только для shared workspace"
            )
