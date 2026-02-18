"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type ComponentType } from "react";
import {
  Bell,
  ChevronRight,
  Coins,
  KeyRound,
  PieChart,
  Repeat,
  Shield,
  Tags,
  Upload,
  Wallet,
} from "lucide-react";
import { ErrorState, LoadingState } from "@/components/async-state";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/features/auth/auth-context";
import type { AccountResponse, CategoryResponse } from "@/lib/types";

type WorkspaceStats = {
  categories: number;
  sources: number;
  apiKeys: number;
};

type SettingLink = {
  href: string;
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  iconClassName: string;
  disabled?: boolean;
};

const SETTINGS_LINKS: SettingLink[] = [
  {
    href: "/settings/currencies",
    title: "Валюты",
    description: "Курсы и отображение сумм",
    icon: Coins,
    iconClassName: "bg-cyan-500/18 text-cyan-500",
  },
  {
    href: "/categories",
    title: "Категории",
    description: "Доходы и расходы",
    icon: Tags,
    iconClassName: "bg-primary-500/15 text-primary-600",
  },
  {
    href: "/accounts",
    title: "Счета",
    description: "Банки, карты и наличные",
    icon: Wallet,
    iconClassName: "bg-success-500/15 text-success-600",
  },
  {
    href: "/recurring",
    title: "Регулярные платежи",
    description: "Подписки и автосписания",
    icon: Repeat,
    iconClassName: "bg-secondary-500/15 text-secondary-600",
  },
  {
    href: "/settings/api-keys",
    title: "API-ключи",
    description: "Внешние интеграции",
    icon: KeyRound,
    iconClassName: "bg-primary-500/15 text-primary-600",
    disabled: true,
  },
  {
    href: "/settings/budgets",
    title: "Лимиты бюджета",
    description: "Ограничения и уведомления",
    icon: PieChart,
    iconClassName: "bg-warning-500/15 text-warning-600",
    disabled: true,
  },
  {
    href: "/settings/notifications",
    title: "Уведомления",
    description: "Напоминания и события",
    icon: Bell,
    iconClassName: "bg-danger-500/15 text-danger-600",
    disabled: true,
  },
  {
    href: "/settings/export",
    title: "Экспорт данных",
    description: "CSV и PDF-отчеты",
    icon: Upload,
    iconClassName: "bg-secondary-500/15 text-secondary-600",
    disabled: true,
  },
  {
    href: "/settings/privacy",
    title: "Конфиденциальность",
    description: "Безопасность и резервные копии",
    icon: Shield,
    iconClassName: "bg-default-400/20 text-[var(--text-secondary)]",
    disabled: true,
  },
];

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return `Ошибка API (${error.status}). Проверьте данные и попробуйте снова.`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Не удалось загрузить настройки рабочего пространства.";
}

export default function SettingsPage() {
  const { authenticatedRequest, user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [stats, setStats] = useState<WorkspaceStats>({ categories: 0, sources: 0, apiKeys: 3 });

  const loadWorkspaceStats = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const [categories, accounts] = await Promise.all([
        authenticatedRequest<CategoryResponse[]>("/api/categories?skip=0&limit=300"),
        authenticatedRequest<AccountResponse[]>("/api/accounts?skip=0&limit=300"),
      ]);
      setStats({
        categories: categories.length,
        sources: accounts.length,
        apiKeys: 3,
      });
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, [authenticatedRequest]);

  useEffect(() => {
    void loadWorkspaceStats();
  }, [loadWorkspaceStats]);

  return (
    <section className="space-y-3">
      <header className="app-panel overflow-hidden">
        <div className="dark-hero px-4 py-4">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">
            Пространство {user?.name ?? "пользователя"}
          </h1>
          <p className="mt-0.5 text-sm text-[var(--text-secondary)]">Личные финансы</p>
          <p className="mt-1 text-xs font-semibold text-cyan-600">
            Управление данными и справочниками
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 p-3">
          <article className="rounded-2xl bg-gradient-to-br from-content2/82 to-content1 p-2.5 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_8px_16px_rgba(2,6,23,0.14)]">
            <p className="text-2xl font-bold text-cyan-500">{stats.categories}</p>
            <p className="text-xs font-semibold text-[var(--text-secondary)]">Категории</p>
          </article>
          <article className="rounded-2xl bg-gradient-to-br from-content2/82 to-content1 p-2.5 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_8px_16px_rgba(2,6,23,0.14)]">
            <p className="text-2xl font-bold text-success-600">{stats.sources}</p>
            <p className="text-xs font-semibold text-[var(--text-secondary)]">Счета</p>
          </article>
          <article className="rounded-2xl bg-gradient-to-br from-content2/82 to-content1 p-2.5 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_8px_16px_rgba(2,6,23,0.14)]">
            <p className="text-2xl font-bold text-warning-600">{stats.apiKeys}</p>
            <p className="text-xs font-semibold text-[var(--text-secondary)]">API-ключи</p>
          </article>
        </div>
      </header>

      {errorMessage ? <ErrorState message={errorMessage} /> : null}
      {isLoading ? <LoadingState message="Загружаем настройки..." /> : null}

      {!isLoading ? (
        <section className="space-y-2">
          <p className="px-1 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)]">
            Настройки
          </p>
          {SETTINGS_LINKS.map((item) => {
            const Icon = item.icon;
            if (item.disabled) {
              return (
                <article
                  key={item.title}
                  className="app-panel flex items-center justify-between gap-3 p-3 opacity-75"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${item.iconClassName}`}>
                      <Icon className="h-4.5 w-4.5" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{item.title}</p>
                      <p className="truncate text-xs text-[var(--text-secondary)]">{item.description}</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-[var(--surface-hover)] px-2 py-1 text-[10px] font-semibold uppercase text-[var(--text-secondary)]">
                    Скоро
                  </span>
                </article>
              );
            }

            return (
              <Link
                key={item.title}
                href={item.href}
                className="app-panel interactive-hover flex items-center justify-between gap-3 p-3 transition"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${item.iconClassName}`}>
                    <Icon className="h-4.5 w-4.5" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{item.title}</p>
                    <p className="truncate text-xs text-[var(--text-secondary)]">{item.description}</p>
                  </div>
                </div>
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-content2/82 to-content1 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_6px_12px_rgba(2,6,23,0.12)]">
                  <ChevronRight className="h-4 w-4 text-[var(--text-secondary)]" />
                </span>
              </Link>
            );
          })}
        </section>
      ) : null}
    </section>
  );
}
