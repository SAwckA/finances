"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Button, Spinner } from "@heroui/react";
import { ArrowDown, ArrowUp, RefreshCcw } from "lucide-react";
import { ErrorState, LoadingState } from "@/components/async-state";
import { ScreenHeader } from "@/components/screen-header";
import { useAuth } from "@/features/auth/auth-context";
import { ApiError } from "@/lib/api-client";
import type {
  AccountBalanceResponse,
  CurrencyResponse,
  PeriodStatisticsResponse,
  TotalBalanceResponse,
} from "@/lib/types";

type PeriodPreset = "7d" | "30d" | "month";

function toDateInputValue(date: Date): string {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function getDefaultRange(): { start: string; end: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 29);
  return {
    start: toDateInputValue(start),
    end: toDateInputValue(end),
  };
}

function getPresetRange(preset: PeriodPreset): { start: string; end: string } {
  const now = new Date();
  const end = toDateInputValue(now);

  if (preset === "7d") {
    const startDate = new Date(now);
    startDate.setDate(now.getDate() - 6);
    return { start: toDateInputValue(startDate), end };
  }

  if (preset === "month") {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    return { start: toDateInputValue(monthStart), end };
  }

  return getDefaultRange();
}

function toApiDate(date: string, endOfDay: boolean): string {
  const time = endOfDay ? "23:59:59" : "00:00:00";
  return new Date(`${date}T${time}`).toISOString();
}

function formatAmount(value: string, currencyCode: string): string {
  const numeric = Number(value);
  if (Number.isNaN(numeric)) {
    return value;
  }

  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(numeric);
}

const AccountBalancesCard = dynamic(() => import("@/components/dashboard/account-balances-card"), {
  loading: () => (
    <section className="mb-4 rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2">
        <Spinner size="sm" />
        <p className="text-sm text-slate-700">Загружаем балансы...</p>
      </div>
    </section>
  ),
});

const CategoryBreakdowns = dynamic(() => import("@/components/dashboard/category-breakdowns"), {
  loading: () => (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2">
        <Spinner size="sm" />
        <p className="text-sm text-slate-700">Загружаем категории...</p>
      </div>
    </section>
  ),
});

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return `Ошибка API (${error.status}). Проверьте данные и попробуйте снова.`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Что-то пошло не так. Попробуйте снова.";
}

export default function DashboardPage() {
  const { authenticatedRequest } = useAuth();
  const initialRange = useMemo(() => getDefaultRange(), []);
  const [selectedCurrency, setSelectedCurrency] = useState("RUB");
  const [preset, setPreset] = useState<PeriodPreset>("30d");
  const [startDate, setStartDate] = useState(initialRange.start);
  const [endDate, setEndDate] = useState(initialRange.end);
  const [currencies, setCurrencies] = useState<CurrencyResponse[]>([]);
  const [totalBalance, setTotalBalance] = useState<TotalBalanceResponse | null>(null);
  const [accountBalances, setAccountBalances] = useState<AccountBalanceResponse[]>([]);
  const [summary, setSummary] = useState<PeriodStatisticsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadCurrencies = useCallback(async () => {
    const currenciesData = await authenticatedRequest<CurrencyResponse[]>(
      "/api/currencies?skip=0&limit=300",
    );
    setCurrencies(currenciesData);
  }, [authenticatedRequest]);

  const loadDashboard = useCallback(async () => {
    if (!startDate || !endDate) {
      return;
    }

    setErrorMessage(null);
    setIsRefreshing(true);

    try {
      const query = new URLSearchParams({
        start_date: toApiDate(startDate, false),
        end_date: toApiDate(endDate, true),
      });

      const [totalData, balancesData, summaryData] = await Promise.all([
        authenticatedRequest<TotalBalanceResponse>(
          `/api/statistics/total?currency=${encodeURIComponent(selectedCurrency)}`,
        ),
        authenticatedRequest<AccountBalanceResponse[]>("/api/statistics/balance"),
        authenticatedRequest<PeriodStatisticsResponse>(`/api/statistics/summary?${query.toString()}`),
      ]);

      setTotalBalance(totalData);
      setAccountBalances(balancesData);
      setSummary(summaryData);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [authenticatedRequest, endDate, selectedCurrency, startDate]);

  useEffect(() => {
    const fetchCurrencies = async () => {
      try {
        await loadCurrencies();
      } catch (error) {
        setErrorMessage(getErrorMessage(error));
      }
    };

    void fetchCurrencies();
  }, [loadCurrencies]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const applyPreset = (nextPreset: PeriodPreset) => {
    setPreset(nextPreset);
    const range = getPresetRange(nextPreset);
    setStartDate(range.start);
    setEndDate(range.end);
  };

  return (
    <>
      <ScreenHeader
        title="Обзор финансов"
        description="Баланс, динамика доходов/расходов и категории за выбранный период."
      />

      <section className="mb-4 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap gap-2">
          {([
            { key: "7d", label: "7 дней" },
            { key: "30d", label: "30 дней" },
            { key: "month", label: "Этот месяц" },
          ] as const).map((option) => (
            <Button
              key={option.key}
              size="sm"
              variant={preset === option.key ? "solid" : "flat"}
              color={preset === option.key ? "primary" : "default"}
              onPress={() => applyPreset(option.key)}
            >
              {option.label}
            </Button>
          ))}
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          <label className="block text-sm text-slate-700">
            Дата от
            <input
              className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              type="date"
              value={startDate}
              onChange={(event) => {
                setPreset("30d");
                setStartDate(event.target.value);
              }}
            />
          </label>

          <label className="block text-sm text-slate-700">
            Дата до
            <input
              className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              type="date"
              value={endDate}
              onChange={(event) => {
                setPreset("30d");
                setEndDate(event.target.value);
              }}
            />
          </label>

          <label className="block text-sm text-slate-700">
            Валюта итога
            <select
              className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              value={selectedCurrency}
              onChange={(event) => setSelectedCurrency(event.target.value)}
            >
              {currencies.map((currency) => (
                <option key={currency.id} value={currency.code}>
                  {currency.code} ({currency.symbol})
                </option>
              ))}
              {currencies.length === 0 ? <option value="RUB">RUB (₽)</option> : null}
            </select>
          </label>
        </div>

        <div className="mt-3 flex justify-end">
          <Button
            size="sm"
            variant="flat"
            startContent={<RefreshCcw className="h-4 w-4" />}
            isLoading={isRefreshing}
            onPress={() => void loadDashboard()}
          >
            Обновить
          </Button>
        </div>
      </section>

      {errorMessage ? <ErrorState className="mb-3" message={errorMessage} /> : null}

      {isLoading ? (
        <LoadingState message="Загружаем аналитику..." />
      ) : (
        <>
          <section className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <article className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-sm text-slate-600">Общий баланс</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">
                {totalBalance ? formatAmount(totalBalance.total_balance, totalBalance.currency_code) : "—"}
              </p>
            </article>

            <article className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
              <div className="flex items-center gap-1 text-sm text-emerald-700">
                <ArrowUp className="h-4 w-4" />
                Доходы
              </div>
              <p className="mt-1 text-xl font-semibold text-emerald-800">
                {summary ? formatAmount(summary.total_income, selectedCurrency) : "—"}
              </p>
            </article>

            <article className="rounded-2xl border border-rose-200 bg-rose-50/70 p-4">
              <div className="flex items-center gap-1 text-sm text-rose-700">
                <ArrowDown className="h-4 w-4" />
                Расходы
              </div>
              <p className="mt-1 text-xl font-semibold text-rose-800">
                {summary ? formatAmount(summary.total_expense, selectedCurrency) : "—"}
              </p>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-sm text-slate-600">Изменение периода</p>
              <p
                className={`mt-1 text-xl font-semibold ${
                  summary && Number(summary.net_change) >= 0 ? "text-emerald-700" : "text-rose-700"
                }`}
              >
                {summary ? formatAmount(summary.net_change, selectedCurrency) : "—"}
              </p>
            </article>
          </section>

          <AccountBalancesCard balances={accountBalances} />
          <CategoryBreakdowns summary={summary} currencyCode={selectedCurrency} />
        </>
      )}
    </>
  );
}
