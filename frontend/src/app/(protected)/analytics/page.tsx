"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Bot, ChevronDown, Lightbulb, Sparkles, TrendingUp } from "lucide-react";
import { ErrorState, LoadingState } from "@/components/async-state";
import { useAuth } from "@/features/auth/auth-context";
import { ApiError } from "@/lib/api-client";
import type { PeriodStatisticsResponse } from "@/lib/types";

type MonthTrendPoint = {
  key: string;
  label: string;
  income: number;
  expense: number;
};

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return `Ошибка API (${error.status}). Проверьте данные и попробуйте снова.`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Не удалось загрузить аналитику.";
}

function toDateInputValue(date: Date): string {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function toApiDate(date: string, endOfDay: boolean): string {
  const time = endOfDay ? "23:59:59" : "00:00:00";
  return new Date(`${date}T${time}`).toISOString();
}

function money(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(value);
}

function parseDecimal(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildSixMonths(): Array<{ start: string; end: string; label: string; key: string }> {
  const now = new Date();
  const items: Array<{ start: string; end: string; label: string; key: string }> = [];

  for (let i = 5; i >= 0; i -= 1) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const start = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
    const end = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
    items.push({
      start: toDateInputValue(start),
      end: toDateInputValue(end),
      label: monthDate.toLocaleDateString("en-US", { month: "short" }),
      key: `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, "0")}`,
    });
  }

  return items;
}

export default function AnalyticsPage() {
  const { authenticatedRequest } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [summary, setSummary] = useState<PeriodStatisticsResponse | null>(null);
  const [monthlyTrend, setMonthlyTrend] = useState<MonthTrendPoint[]>([]);

  const loadAnalytics = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const now = new Date();
      const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const thisMonthQuery = new URLSearchParams({
        start_date: toApiDate(toDateInputValue(periodStart), false),
        end_date: toApiDate(toDateInputValue(periodEnd), true),
      });

      const months = buildSixMonths();
      const monthPromises = months.map(async (month) => {
        const query = new URLSearchParams({
          start_date: toApiDate(month.start, false),
          end_date: toApiDate(month.end, true),
        });
        const data = await authenticatedRequest<PeriodStatisticsResponse>(
          `/api/statistics/summary?${query.toString()}`,
        );
        return {
          key: month.key,
          label: month.label,
          income: parseDecimal(data.total_income),
          expense: parseDecimal(data.total_expense),
        };
      });

      const [thisMonthSummary, sixMonthTrend] = await Promise.all([
        authenticatedRequest<PeriodStatisticsResponse>(
          `/api/statistics/summary?${thisMonthQuery.toString()}`,
        ),
        Promise.all(monthPromises),
      ]);

      setSummary(thisMonthSummary);
      setMonthlyTrend(sixMonthTrend);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, [authenticatedRequest]);

  useEffect(() => {
    void loadAnalytics();
  }, [loadAnalytics]);

  const topExpenses = useMemo(() => {
    return (summary?.expense_by_category ?? []).slice(0, 4);
  }, [summary?.expense_by_category]);

  const totalExpense = parseDecimal(summary?.total_expense ?? "0");
  const donutStyle = useMemo(() => {
    if (!topExpenses.length || totalExpense <= 0) {
      return { background: "conic-gradient(#d5d9e5 0deg 360deg)" };
    }

    const palette = ["#e25755", "#4d71e7", "#8f5cf6", "#f0a128"];
    let cursor = 0;
    const slices = topExpenses.map((item, index) => {
      const value = parseDecimal(item.amount);
      const angle = Math.max(2, Math.round((value / totalExpense) * 360));
      const start = cursor;
      cursor += angle;
      return `${palette[index % palette.length]} ${start}deg ${Math.min(cursor, 360)}deg`;
    });
    if (cursor < 360) {
      slices.push(`#d5d9e5 ${cursor}deg 360deg`);
    }

    return { background: `conic-gradient(${slices.join(", ")})` };
  }, [topExpenses, totalExpense]);

  const maxTrendExpense = useMemo(() => {
    if (!monthlyTrend.length) {
      return 1;
    }

    return Math.max(1, ...monthlyTrend.map((point) => point.expense));
  }, [monthlyTrend]);

  return (
    <section className="space-y-3">
      <div className="mobile-card p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h1 className="section-title text-[1.2rem]">Analytics</h1>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600"
              aria-label="AI assistant"
            >
              <Bot className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600"
              aria-label="Filters"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="rounded-2xl bg-indigo-100/70 p-3">
          <p className="text-sm font-semibold text-slate-800">AI Insights</p>
          <p className="text-xs text-slate-500">Powered by FinanceAI</p>
          <p className="mt-2 text-sm text-slate-700">
            You{"'"}re spending 23% more on dining this month. Consider setting a budget limit of
            $200.
          </p>
          <button
            type="button"
            className="mt-2 text-xs font-semibold text-indigo-600"
          >
            View Recommendations
          </button>
        </div>
      </div>

      {errorMessage ? <ErrorState message={errorMessage} /> : null}
      {isLoading ? <LoadingState message="Собираем аналитику..." /> : null}

      {!isLoading && !errorMessage ? (
        <>
          <article className="mobile-card p-3">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-800">Spending Overview</h2>
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600"
              >
                This Month <ChevronDown className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="flex justify-center py-2">
              <div className="relative h-36 w-36 rounded-full" style={donutStyle}>
                <span className="absolute inset-[22px] rounded-full bg-white" />
              </div>
            </div>
          </article>

          <article className="mobile-card p-3">
            <h2 className="mb-2 text-base font-semibold text-slate-800">Category Breakdown</h2>
            <div className="space-y-2">
              {topExpenses.map((item) => {
                const value = parseDecimal(item.amount);
                const share = totalExpense > 0 ? Math.round((value / totalExpense) * 100) : 0;
                return (
                  <div key={item.category_id} className="rounded-xl border border-slate-200 p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-800">{item.category_name}</p>
                      <p className="text-sm font-semibold text-slate-800">{money(value)}</p>
                    </div>
                    <div className="mt-1.5 h-1.5 rounded-full bg-slate-200">
                      <div
                        className="h-1.5 rounded-full bg-indigo-500"
                        style={{ width: `${Math.max(2, Math.min(100, share))}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </article>

          <article className="mobile-card p-3">
            <h2 className="mb-2 text-base font-semibold text-slate-800">Monthly Trends</h2>
            <div className="h-32 rounded-xl border border-slate-200 px-2 py-1.5">
              <div className="flex h-full items-end gap-2">
                {monthlyTrend.map((point) => {
                  const ratio = Math.max(6, Math.round((point.expense / maxTrendExpense) * 100));
                  return (
                    <div key={point.key} className="flex flex-1 flex-col items-center justify-end gap-1">
                      <div className="w-full rounded-t-md bg-indigo-500/75" style={{ height: `${ratio}%` }} />
                      <span className="text-[10px] font-semibold text-slate-500">{point.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </article>

          <article className="mobile-card border-emerald-100 bg-emerald-50 p-3">
            <div className="mb-1.5 flex items-center gap-1.5 text-emerald-700">
              <Sparkles className="h-4 w-4" />
              <p className="text-sm font-semibold">Smart Predictions</p>
            </div>
            <p className="text-sm text-emerald-800/85">
              На следующей неделе вероятно увеличение трат на транспорт и еду. Рекомендуем
              подготовить лимит заранее.
            </p>
            <div className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
              <Lightbulb className="h-3.5 w-3.5" />
              <span>Forecast confidence: high</span>
            </div>
            <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-white/70 px-2 py-1 text-xs font-semibold text-emerald-700">
              <TrendingUp className="h-3.5 w-3.5" />
              Budget health: stable
            </div>
          </article>
        </>
      ) : null}
    </section>
  );
}
