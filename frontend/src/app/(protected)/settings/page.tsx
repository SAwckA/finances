"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type ComponentType } from "react";
import {
  Bell,
  ChevronRight,
  KeyRound,
  PieChart,
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
    href: "/categories",
    title: "Categories",
    description: "Manage expense categories",
    icon: Tags,
    iconClassName: "bg-blue-50 text-blue-600",
  },
  {
    href: "/accounts",
    title: "Payment Sources",
    description: "Banks, cards & wallets",
    icon: Wallet,
    iconClassName: "bg-emerald-50 text-emerald-600",
  },
  {
    href: "/settings/api-keys",
    title: "API Keys",
    description: "External integrations",
    icon: KeyRound,
    iconClassName: "bg-violet-50 text-violet-600",
    disabled: true,
  },
  {
    href: "/settings/budgets",
    title: "Budget Settings",
    description: "Limits & alerts",
    icon: PieChart,
    iconClassName: "bg-orange-50 text-orange-600",
    disabled: true,
  },
  {
    href: "/settings/notifications",
    title: "Notifications",
    description: "Alerts & reminders",
    icon: Bell,
    iconClassName: "bg-rose-50 text-rose-600",
    disabled: true,
  },
  {
    href: "/settings/export",
    title: "Data Export",
    description: "CSV, PDF reports",
    icon: Upload,
    iconClassName: "bg-indigo-50 text-indigo-600",
    disabled: true,
  },
  {
    href: "/settings/privacy",
    title: "Privacy & Security",
    description: "Permissions & backup",
    icon: Shield,
    iconClassName: "bg-slate-100 text-slate-600",
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

  return "Не удалось загрузить настройки workspace.";
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
      <header className="mobile-card overflow-hidden">
        <div className="dark-hero px-4 py-4">
          <h1 className="text-2xl font-bold text-white/95">
            {(user?.name ?? "User") + "'s"} Workspace
          </h1>
          <p className="mt-0.5 text-sm text-white/80">Personal Finance</p>
          <p className="mt-1 text-xs font-semibold text-emerald-300">Active • {stats.sources} sources connected</p>
        </div>
        <div className="grid grid-cols-3 gap-2 p-3">
          <article className="rounded-xl border border-slate-200 bg-white p-2.5 text-center">
            <p className="text-2xl font-bold text-indigo-600">{stats.categories}</p>
            <p className="text-xs font-semibold text-slate-500">Categories</p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-white p-2.5 text-center">
            <p className="text-2xl font-bold text-emerald-600">{stats.sources}</p>
            <p className="text-xs font-semibold text-slate-500">Sources</p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-white p-2.5 text-center">
            <p className="text-2xl font-bold text-orange-600">{stats.apiKeys}</p>
            <p className="text-xs font-semibold text-slate-500">API Keys</p>
          </article>
        </div>
      </header>

      {errorMessage ? <ErrorState message={errorMessage} /> : null}
      {isLoading ? <LoadingState message="Загружаем настройки workspace..." /> : null}

      {!isLoading ? (
        <section className="space-y-2">
          {SETTINGS_LINKS.map((item) => {
            const Icon = item.icon;
            if (item.disabled) {
              return (
                <article
                  key={item.title}
                  className="mobile-card flex items-center justify-between gap-3 p-3 opacity-70"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${item.iconClassName}`}>
                      <Icon className="h-4.5 w-4.5" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800">{item.title}</p>
                      <p className="truncate text-xs text-slate-500">{item.description}</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold uppercase text-slate-500">
                    Soon
                  </span>
                </article>
              );
            }

            return (
              <Link key={item.title} href={item.href} className="mobile-card flex items-center justify-between gap-3 p-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${item.iconClassName}`}>
                    <Icon className="h-4.5 w-4.5" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800">{item.title}</p>
                    <p className="truncate text-xs text-slate-500">{item.description}</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-400" />
              </Link>
            );
          })}
        </section>
      ) : null}
    </section>
  );
}
