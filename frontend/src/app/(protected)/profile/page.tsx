"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@heroui/react";
import { Mail, ShieldCheck, UserCircle2 } from "lucide-react";
import { ErrorState, LoadingState } from "@/components/async-state";
import { UiPageHeader } from "@/components/ui/ui-page-header";
import { UiSegmentedControl } from "@/components/ui/ui-segmented-control";
import { useAuth } from "@/features/auth/auth-context";
import { useThemePreference } from "@/features/theme/theme-context";
import { ApiError } from "@/lib/api-client";
import type {
  UserResponse,
  UserUpdate,
  WorkspaceMemberResponse,
  WorkspaceResponse,
} from "@/lib/types";

type ProfileFormState = {
  name: string;
};

const FORM_FIELD_SHELL_CLASS =
  "mt-1.5 flex items-center gap-2 rounded-2xl bg-gradient-to-br from-content2/82 to-content1 px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_10px_22px_rgba(2,6,23,0.18)] transition focus-within:shadow-[0_0_0_2px_var(--ring-primary),inset_0_1px_0_rgba(255,255,255,0.1),0_12px_24px_rgba(2,6,23,0.24)]";

const FORM_FIELD_INPUT_CLASS =
  "w-full bg-transparent py-0.5 text-base font-semibold text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] outline-none";

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return `Ошибка API (${error.status}). Проверьте данные и попробуйте снова.`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Что-то пошло не так. Попробуйте снова.";
}

export default function ProfilePage() {
  const {
    user,
    workspaces,
    activeWorkspace,
    activeWorkspaceId,
    setActiveWorkspace,
    refreshWorkspaces,
    refreshProfile,
    authenticatedRequest,
    logout,
  } = useAuth();
  const router = useRouter();
  const { preference, resolvedTheme, setPreference } = useThemePreference();

  const [form, setForm] = useState<ProfileFormState>({ name: user?.name ?? "" });
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [workspaceMembers, setWorkspaceMembers] = useState<WorkspaceMemberResponse[]>([]);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [workspaceActionLoading, setWorkspaceActionLoading] = useState(false);
  const [workspaceErrorMessage, setWorkspaceErrorMessage] = useState<string | null>(null);
  const [workspaceSuccessMessage, setWorkspaceSuccessMessage] = useState<string | null>(null);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [renameWorkspaceName, setRenameWorkspaceName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");

  const isWorkspaceOwner = useMemo(() => {
    if (!activeWorkspace || !user) {
      return false;
    }
    return activeWorkspace.owner_user_id === user.id;
  }, [activeWorkspace, user]);

  const ownedSharedCount = useMemo(() => {
    if (!user) {
      return 0;
    }
    return workspaces.filter((workspace) => workspace.kind === "shared" && workspace.owner_user_id === user.id)
      .length;
  }, [user, workspaces]);

  const canCreateSharedWorkspace = ownedSharedCount < 1;

  const loadProfile = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const current = await refreshProfile();
      setForm({ name: current.name });
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, [refreshProfile]);

  const loadMembers = useCallback(async () => {
    if (!activeWorkspaceId) {
      setWorkspaceMembers([]);
      return;
    }

    setWorkspaceLoading(true);
    setWorkspaceErrorMessage(null);

    try {
      const members = await authenticatedRequest<WorkspaceMemberResponse[]>(
        `/api/workspaces/${activeWorkspaceId}/members`,
      );
      setWorkspaceMembers(members);
    } catch (error) {
      setWorkspaceErrorMessage(getErrorMessage(error));
    } finally {
      setWorkspaceLoading(false);
    }
  }, [activeWorkspaceId, authenticatedRequest]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    setRenameWorkspaceName(activeWorkspace?.name ?? "");
    void loadMembers();
  }, [activeWorkspace?.name, activeWorkspaceId, loadMembers]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!form.name.trim()) {
      setErrorMessage("Укажите имя.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const payload: UserUpdate = { name: form.name.trim() };
      const updated = await authenticatedRequest<UserResponse>("/api/users/me", {
        method: "PUT",
        body: payload,
      });
      setForm({ name: updated.name });
      setSuccessMessage("Профиль обновлен.");
      await refreshProfile();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const runWorkspaceAction = async (action: () => Promise<void>) => {
    setWorkspaceActionLoading(true);
    setWorkspaceErrorMessage(null);
    setWorkspaceSuccessMessage(null);

    try {
      await action();
    } catch (error) {
      setWorkspaceErrorMessage(getErrorMessage(error));
    } finally {
      setWorkspaceActionLoading(false);
    }
  };

  const handleCreateWorkspace = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = newWorkspaceName.trim();
    if (!name) {
      setWorkspaceErrorMessage("Укажите название нового workspace.");
      return;
    }

    await runWorkspaceAction(async () => {
      const created = await authenticatedRequest<WorkspaceResponse>("/api/workspaces", {
        method: "POST",
        body: { name },
      });
      const refreshed = await refreshWorkspaces();
      setActiveWorkspace(created.id);
      setNewWorkspaceName("");
      setWorkspaceSuccessMessage("Shared workspace создан.");
      if (!refreshed.some((workspace) => workspace.id === created.id)) {
        setWorkspaceErrorMessage("Новый workspace не найден после обновления списка.");
      }
      await loadMembers();
    });
  };

  const handleRenameWorkspace = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activeWorkspace) {
      return;
    }

    const name = renameWorkspaceName.trim();
    if (!name) {
      setWorkspaceErrorMessage("Укажите название workspace.");
      return;
    }

    await runWorkspaceAction(async () => {
      await authenticatedRequest<WorkspaceResponse>(`/api/workspaces/${activeWorkspace.id}`, {
        method: "PATCH",
        body: { name },
      });
      await refreshWorkspaces();
      setWorkspaceSuccessMessage("Название workspace обновлено.");
    });
  };

  const handleAddMember = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activeWorkspace) {
      return;
    }

    const email = inviteEmail.trim().toLowerCase();
    if (!email) {
      setWorkspaceErrorMessage("Укажите email участника.");
      return;
    }

    await runWorkspaceAction(async () => {
      await authenticatedRequest(`/api/workspaces/${activeWorkspace.id}/members`, {
        method: "POST",
        body: { email },
      });
      setInviteEmail("");
      setWorkspaceSuccessMessage("Участник добавлен.");
      await loadMembers();
    });
  };

  const handleRemoveMember = async (memberUserId: number) => {
    if (!activeWorkspace) {
      return;
    }

    await runWorkspaceAction(async () => {
      await authenticatedRequest(`/api/workspaces/${activeWorkspace.id}/members/${memberUserId}`, {
        method: "DELETE",
      });
      setWorkspaceSuccessMessage("Участник удален.");
      await loadMembers();
    });
  };

  const handleTransferOwnership = async (newOwnerUserId: number) => {
    if (!activeWorkspace) {
      return;
    }

    await runWorkspaceAction(async () => {
      await authenticatedRequest<WorkspaceResponse>(
        `/api/workspaces/${activeWorkspace.id}/transfer-ownership`,
        {
          method: "POST",
          body: { new_owner_user_id: newOwnerUserId },
        },
      );
      await refreshWorkspaces();
      setWorkspaceSuccessMessage("Права владельца переданы.");
      await loadMembers();
    });
  };

  const handleDeleteWorkspace = async () => {
    if (!activeWorkspace) {
      return;
    }

    await runWorkspaceAction(async () => {
      await authenticatedRequest(`/api/workspaces/${activeWorkspace.id}`, { method: "DELETE" });
      await refreshWorkspaces();
      setWorkspaceSuccessMessage("Workspace удален.");
      await loadMembers();
    });
  };

  const handleLeaveWorkspace = async () => {
    if (!activeWorkspace) {
      return;
    }

    await runWorkspaceAction(async () => {
      await authenticatedRequest(`/api/workspaces/${activeWorkspace.id}/leave`, { method: "POST" });
      await refreshWorkspaces();
      setWorkspaceSuccessMessage("Вы вышли из workspace.");
      await loadMembers();
    });
  };

  return (
    <>
      <UiPageHeader title="Профиль" description="Управление данными текущего пользователя." />
      <div className="space-y-4">
        <section className="app-panel overflow-hidden">
          <div className="dark-hero px-4 py-4">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500/16 text-cyan-600">
                <UserCircle2 className="h-7 w-7" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-lg font-bold text-[var(--text-primary)]">{form.name || "Пользователь"}</p>
                <p className="truncate text-sm text-[var(--text-secondary)]">{user?.email ?? "—"}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="app-panel p-4">
          <div className="mb-1.5 flex items-center gap-2">
            <ShieldCheck className="h-4.5 w-4.5 text-cyan-500" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Тема приложения</h2>
          </div>
          <div className="space-y-2">
            <UiSegmentedControl
              options={[
                { key: "system", label: "Система" },
                { key: "light", label: "Светлая" },
                { key: "dark", label: "Темная" },
              ]}
              value={preference}
              onChange={setPreference}
            />
            <p className="text-xs text-[var(--text-secondary)]">
              Текущая тема: {resolvedTheme === "dark" ? "темная" : "светлая"}.
            </p>
          </div>
        </section>

        <section className="app-panel p-4">
          {isLoading ? (
            <LoadingState
              className="rounded-none border-none bg-transparent p-0"
              message="Загружаем профиль..."
            />
          ) : (
            <form className="space-y-3" onSubmit={handleSubmit}>
              <label className="block text-sm text-[var(--text-secondary)]">
                Электронная почта
                <div className={FORM_FIELD_SHELL_CLASS}>
                  <Mail className="h-4 w-4 shrink-0 text-[var(--text-secondary)]" aria-hidden="true" />
                  <input className={FORM_FIELD_INPUT_CLASS} type="email" value={user?.email ?? ""} readOnly />
                </div>
              </label>

              <label className="block text-sm text-[var(--text-secondary)]">
                Имя
                <div className={FORM_FIELD_SHELL_CLASS}>
                  <UserCircle2 className="h-4 w-4 shrink-0 text-[var(--text-secondary)]" aria-hidden="true" />
                  <input
                    className={FORM_FIELD_INPUT_CLASS}
                    value={form.name}
                    onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                    placeholder="Введите имя"
                    required
                  />
                </div>
              </label>

              {errorMessage ? (
                <ErrorState
                  className="rounded-lg border border-danger-200 bg-danger-50 px-2.5 py-2 text-sm text-danger-700"
                  message={errorMessage}
                />
              ) : null}
              {successMessage ? <p className="text-sm text-success-700">{successMessage}</p> : null}

              <div className="flex flex-wrap gap-2">
                <Button
                  className="bg-[var(--accent-primary)] text-white data-[disabled=true]:bg-content3 data-[disabled=true]:text-[var(--text-secondary)]"
                  type="submit"
                  isLoading={isSubmitting}
                >
                  Сохранить
                </Button>
                <Button variant="flat" type="button" onPress={() => void loadProfile()}>
                  Обновить
                </Button>
              </div>
            </form>
          )}
        </section>

        <section className="app-panel p-4">
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Workspaces</h2>
            <p className="text-xs text-[var(--text-secondary)]">Переключение и совместный доступ.</p>
          </div>

          <div className="space-y-3">
            <label className="block text-xs text-[var(--text-secondary)]">
              Активный workspace
              <select
                className="mt-1 w-full rounded-xl border border-[var(--border-soft)] bg-content1 px-3 py-2 text-sm text-[var(--text-primary)]"
                value={activeWorkspaceId ?? ""}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  if (Number.isInteger(next) && next > 0) {
                    setActiveWorkspace(next);
                  }
                }}
              >
                {workspaces.map((workspace) => (
                  <option key={workspace.id} value={workspace.id}>
                    {workspace.name} ({workspace.kind === "personal" ? "personal" : "shared"})
                  </option>
                ))}
              </select>
            </label>

            <div className="flex flex-wrap gap-2">
              <Button variant="flat" type="button" onPress={() => void refreshWorkspaces()}>
                Обновить список
              </Button>
            </div>

            {canCreateSharedWorkspace ? (
              <form className="space-y-2" onSubmit={handleCreateWorkspace}>
                <label className="block text-xs text-[var(--text-secondary)]">
                  Новый shared workspace
                  <input
                    className="mt-1 w-full rounded-xl border border-[var(--border-soft)] bg-content1 px-3 py-2 text-sm text-[var(--text-primary)]"
                    value={newWorkspaceName}
                    onChange={(event) => setNewWorkspaceName(event.target.value)}
                    placeholder="Название workspace"
                  />
                </label>
                <Button type="submit" isLoading={workspaceActionLoading}>
                  Создать shared workspace
                </Button>
              </form>
            ) : (
              <p className="text-xs text-warning-700">Лимит shared workspace (1) уже исчерпан.</p>
            )}

            {activeWorkspace ? (
              <>
                <div className="rounded-xl border border-[var(--border-soft)] bg-content1 p-3">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">{activeWorkspace.name}</p>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Тип: {activeWorkspace.kind}. Владелец: user #{activeWorkspace.owner_user_id}
                  </p>
                </div>

                {isWorkspaceOwner ? (
                  <form className="space-y-2" onSubmit={handleRenameWorkspace}>
                    <label className="block text-xs text-[var(--text-secondary)]">
                      Переименовать workspace
                      <input
                        className="mt-1 w-full rounded-xl border border-[var(--border-soft)] bg-content1 px-3 py-2 text-sm text-[var(--text-primary)]"
                        value={renameWorkspaceName}
                        onChange={(event) => setRenameWorkspaceName(event.target.value)}
                      />
                    </label>
                    <Button type="submit" isLoading={workspaceActionLoading}>
                      Сохранить название
                    </Button>
                  </form>
                ) : null}

                {activeWorkspace.kind === "shared" && isWorkspaceOwner ? (
                  <form className="space-y-2" onSubmit={handleAddMember}>
                    <label className="block text-xs text-[var(--text-secondary)]">
                      Добавить участника по email
                      <input
                        className="mt-1 w-full rounded-xl border border-[var(--border-soft)] bg-content1 px-3 py-2 text-sm text-[var(--text-primary)]"
                        type="email"
                        value={inviteEmail}
                        onChange={(event) => setInviteEmail(event.target.value)}
                        placeholder="user@example.com"
                      />
                    </label>
                    <Button type="submit" isLoading={workspaceActionLoading}>
                      Добавить участника
                    </Button>
                  </form>
                ) : null}

                {activeWorkspace.kind === "shared" && !isWorkspaceOwner ? (
                  <Button
                    type="button"
                    variant="flat"
                    className="bg-warning-500/15 text-warning-700"
                    isLoading={workspaceActionLoading}
                    onPress={() => void handleLeaveWorkspace()}
                  >
                    Выйти из workspace
                  </Button>
                ) : null}

                {activeWorkspace.kind === "shared" && isWorkspaceOwner ? (
                  <p className="text-xs text-[var(--text-secondary)]">
                    Владелец не может выйти из workspace, пока не передаст права другому участнику.
                  </p>
                ) : null}

                {workspaceLoading ? <LoadingState message="Загружаем участников..." /> : null}
                {!workspaceLoading ? (
                  <div className="space-y-2">
                    {workspaceMembers.map((member) => {
                      const isCurrentUser = member.user_id === user?.id;
                      const canPromote = isWorkspaceOwner && member.role !== "owner";
                      const canRemove = isWorkspaceOwner && member.role !== "owner";

                      return (
                        <div
                          key={member.user_id}
                          className="rounded-xl border border-[var(--border-soft)] bg-content1 p-3"
                        >
                          <p className="text-sm font-semibold text-[var(--text-primary)]">
                            {member.name} {isCurrentUser ? "(вы)" : ""}
                          </p>
                          <p className="text-xs text-[var(--text-secondary)]">
                            {member.email} • {member.role}
                          </p>
                          {(canPromote || canRemove) && (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {canPromote ? (
                                <Button
                                  size="sm"
                                  type="button"
                                  isLoading={workspaceActionLoading}
                                  onPress={() => void handleTransferOwnership(member.user_id)}
                                >
                                  Сделать владельцем
                                </Button>
                              ) : null}
                              {canRemove ? (
                                <Button
                                  size="sm"
                                  variant="flat"
                                  className="bg-danger-500/12 text-danger-600"
                                  type="button"
                                  isLoading={workspaceActionLoading}
                                  onPress={() => void handleRemoveMember(member.user_id)}
                                >
                                  Удалить
                                </Button>
                              ) : null}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : null}

                {activeWorkspace.kind === "shared" && isWorkspaceOwner ? (
                  <Button
                    type="button"
                    variant="flat"
                    className="bg-danger-500/12 text-danger-600"
                    isLoading={workspaceActionLoading}
                    onPress={() => void handleDeleteWorkspace()}
                  >
                    Удалить shared workspace
                  </Button>
                ) : null}
              </>
            ) : (
              <p className="text-xs text-[var(--text-secondary)]">Доступных workspace пока нет.</p>
            )}

            {workspaceErrorMessage ? <ErrorState message={workspaceErrorMessage} /> : null}
            {workspaceSuccessMessage ? (
              <p className="text-sm text-success-700">{workspaceSuccessMessage}</p>
            ) : null}
          </div>
        </section>

        <section className="app-panel p-4">
          <Button
            className="w-full bg-danger-500/12 text-danger-600"
            type="button"
            onPress={() => {
              logout();
              router.replace("/auth/login");
            }}
          >
            Выйти из аккаунта
          </Button>
        </section>
      </div>
    </>
  );
}
