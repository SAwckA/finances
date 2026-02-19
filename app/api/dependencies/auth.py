import logging
from dataclasses import dataclass

from fastapi import Depends, Header
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.auth.jwt import InvalidTokenException, decode_token
from app.exceptions import ForbiddenException
from app.models.user import User
from app.models.workspace import Workspace, WorkspaceMembership, WorkspaceRole
from app.services.workspace_service import WorkspaceService
from app.services.user_service import UserService

logger = logging.getLogger(__name__)

bearer_scheme = HTTPBearer(auto_error=False)


@dataclass
class WorkspaceContext:
    """Контекст активного рабочего пространства запроса."""

    user: User
    workspace: Workspace
    membership: WorkspaceMembership

    @property
    def workspace_id(self) -> int:
        return self.workspace.id

    @property
    def role(self) -> WorkspaceRole:
        return self.membership.role

    @property
    def is_owner(self) -> bool:
        return self.membership.role == WorkspaceRole.OWNER


async def get_current_user_optional(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> User | None:
    """Получение текущего пользователя (опционально)."""
    if not credentials:
        return None

    try:
        payload = decode_token(credentials.credentials)
        async with UserService() as service:
            return await service.get_user_by_id(payload.user_id)
    except Exception:
        return None


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> User:
    """Получение текущего пользователя (обязательно)."""
    if not credentials:
        raise InvalidTokenException(message="Требуется аутентификация")

    payload = decode_token(credentials.credentials)

    async with UserService() as service:
        return await service.get_user_by_id(payload.user_id)


async def get_current_active_user(
    user: User = Depends(get_current_user),
) -> User:
    """Получение активного пользователя."""
    if not user.is_active:
        raise ForbiddenException(message="Аккаунт деактивирован")
    return user


async def get_current_workspace_context(
    user: User = Depends(get_current_active_user),
    x_workspace_id: int | None = Header(None, alias="X-Workspace-Id"),
) -> WorkspaceContext:
    """Получение активного рабочего пространства пользователя."""
    async with WorkspaceService() as service:
        workspace, membership = await service.resolve_workspace_for_user(
            user_id=user.id,
            requested_workspace_id=x_workspace_id,
        )
    return WorkspaceContext(user=user, workspace=workspace, membership=membership)
