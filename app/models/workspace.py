from datetime import datetime
from enum import Enum

from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy import Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel as ORMBaseModel
from app.models.base import SoftDeleteModel


class WorkspaceKind(str, Enum):
    """Тип рабочего пространства."""

    PERSONAL = "personal"
    SHARED = "shared"


class WorkspaceRole(str, Enum):
    """Роль участника в рабочем пространстве."""

    OWNER = "owner"
    EDITOR = "editor"


class WorkspaceBase(BaseModel):
    """Базовая схема рабочего пространства."""

    name: str = Field(min_length=1, max_length=120)


class WorkspaceCreate(WorkspaceBase):
    """Схема создания shared workspace."""

    pass


class WorkspaceUpdate(BaseModel):
    """Схема обновления workspace."""

    name: str = Field(min_length=1, max_length=120)


class WorkspaceResponse(WorkspaceBase):
    """Схема ответа рабочего пространства."""

    id: int
    kind: WorkspaceKind
    owner_user_id: int
    personal_for_user_id: int | None
    created_at: datetime

    model_config = {"from_attributes": True}


class WorkspaceMemberResponse(BaseModel):
    """Схема ответа участника рабочего пространства."""

    user_id: int
    email: EmailStr
    name: str
    role: WorkspaceRole
    joined_at: datetime


class AddWorkspaceMemberRequest(BaseModel):
    """Схема добавления участника в workspace."""

    email: EmailStr


class TransferWorkspaceOwnershipRequest(BaseModel):
    """Схема передачи владения workspace."""

    new_owner_user_id: int


class Workspace(SoftDeleteModel):
    """ORM модель рабочего пространства."""

    __tablename__ = "workspaces"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    kind: Mapped[WorkspaceKind] = mapped_column(SQLEnum(WorkspaceKind), index=True)

    owner_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    personal_for_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"),
        unique=True,
        nullable=True,
        index=True,
    )

    owner = relationship("User", foreign_keys=[owner_user_id])
    personal_for_user = relationship("User", foreign_keys=[personal_for_user_id])
    memberships = relationship(
        "WorkspaceMembership",
        back_populates="workspace",
        cascade="all, delete-orphan",
    )


class WorkspaceMembership(ORMBaseModel):
    """ORM модель membership пользователя в workspace."""

    __tablename__ = "workspace_memberships"
    __table_args__ = (
        UniqueConstraint(
            "workspace_id", "user_id", name="uq_workspace_memberships_pair"
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    workspace_id: Mapped[int] = mapped_column(ForeignKey("workspaces.id"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    role: Mapped[WorkspaceRole] = mapped_column(SQLEnum(WorkspaceRole))

    workspace = relationship("Workspace", back_populates="memberships")
    user = relationship("User")
