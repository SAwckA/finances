"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@heroui/react";
import { Mail, ShieldCheck, UserCircle2 } from "lucide-react";
import { ErrorState, LoadingState } from "@/components/async-state";
import { UiPageHeader } from "@/components/ui/ui-page-header";
import { UiSegmentedControl } from "@/components/ui/ui-segmented-control";
import { useAuth } from "@/features/auth/auth-context";
import { useThemePreference } from "@/features/theme/theme-context";
import { ApiError } from "@/lib/api-client";
import type { UserResponse, UserUpdate } from "@/lib/types";

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
  const { user, refreshProfile, authenticatedRequest, logout } = useAuth();
  const router = useRouter();
  const { preference, resolvedTheme, setPreference } = useThemePreference();
  const [form, setForm] = useState<ProfileFormState>({
    name: user?.name ?? "",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

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
      const payload: UserUpdate = {
        name: form.name.trim(),
      };
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
                  <input
                    className={FORM_FIELD_INPUT_CLASS}
                    type="email"
                    value={user?.email ?? ""}
                    readOnly
                  />
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
