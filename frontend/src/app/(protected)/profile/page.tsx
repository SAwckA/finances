"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@heroui/react";
import { ErrorState, LoadingState } from "@/components/async-state";
import { ScreenHeader } from "@/components/screen-header";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useAuth } from "@/features/auth/auth-context";
import { useThemePreference } from "@/features/theme/theme-context";
import { ApiError } from "@/lib/api-client";
import type { UserResponse, UserUpdate } from "@/lib/types";

type ProfileFormState = {
  name: string;
};

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
      <ScreenHeader title="Профиль" description="Управление данными текущего пользователя." />
      <div className="space-y-4">
        <section className="app-panel p-4">
          <div className="mb-4 space-y-2">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Тема приложения</h2>
            <SegmentedControl
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
              <Input label="Email" type="email" value={user?.email ?? ""} isReadOnly />
              <Input
                label="Имя"
                isRequired
                value={form.name}
                onValueChange={(value) => setForm((prev) => ({ ...prev, name: value }))}
              />

              {errorMessage ? (
                <ErrorState
                  className="rounded-lg border border-danger-200 bg-danger-50 px-2.5 py-2 text-sm text-danger-700"
                  message={errorMessage}
                />
              ) : null}
              {successMessage ? <p className="text-sm text-success-700">{successMessage}</p> : null}

              <div className="flex flex-wrap gap-2">
                <Button color="primary" type="submit" isLoading={isSubmitting}>
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
            color="danger"
            variant="flat"
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
