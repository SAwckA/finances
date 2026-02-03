"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRightLeft, Plus, Send, WalletCards } from "lucide-react";
import { ErrorState, LoadingState } from "@/components/async-state";
import { ActionTile } from "@/components/ui/action-tile";
import { BalanceHeroCard } from "@/components/ui/balance-hero-card";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { SourceCard } from "@/components/ui/source-card";
import { TransactionRow } from "@/components/ui/transaction-row";
import { useAuth } from "@/features/auth/auth-context";
import { ApiError } from "@/lib/api-client";
import type {
  AccountBalanceResponse,
  AccountResponse,
  CategoryResponse,
  CurrencyResponse,
  PeriodStatisticsResponse,
  TotalBalanceResponse,
  TransactionResponse,
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

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numeric);
}

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return `Ошибка API (${error.status}). Проверьте данные и попробуйте снова.`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Что-то пошло не так. Попробуйте снова.";
}

function formatDateLabel(isoValue: string): string {
  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  const today = new Date();
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const startDate = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const diffDays = Math.round((startToday - startDate) / 86_400_000);

  if (diffDays <= 0) {
    return "Today";
  }
  if (diffDays === 1) {
    return "Yesterday";
  }
  if (diffDays <= 6) {
    return `${diffDays} days ago`;
  }

  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
}

function sortByNewest(items: TransactionResponse[]): TransactionResponse[] {
  return [...items].sort(
    (first, second) =>
      new Date(second.transaction_date).getTime() - new Date(first.transaction_date).getTime(),
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { authenticatedRequest } = useAuth();
  const initialRange = useMemo(() => getDefaultRange(), []);
  const [selectedCurrency, setSelectedCurrency] = useState("USD");
  const [preset, setPreset] = useState<PeriodPreset>("30d");
  const [startDate, setStartDate] = useState(initialRange.start);
  const [endDate, setEndDate] = useState(initialRange.end);
  const [currencies, setCurrencies] = useState<CurrencyResponse[]>([]);
  const [totalBalance, setTotalBalance] = useState<TotalBalanceResponse | null>(null);
  const [accountBalances, setAccountBalances] = useState<AccountBalanceResponse[]>([]);
  const [summary, setSummary] = useState<PeriodStatisticsResponse | null>(null);
  const [accounts, setAccounts] = useState<AccountResponse[]>([]);
  const [categories, setCategories] = useState<CategoryResponse[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<TransactionResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

      const [
        totalData,
        balancesData,
        summaryData,
        transactionsData,
        accountsData,
        categoriesData,
        currenciesData,
      ] = await Promise.all([
        authenticatedRequest<TotalBalanceResponse>(
          `/api/statistics/total?currency=${encodeURIComponent(selectedCurrency)}`,
        ),
        authenticatedRequest<AccountBalanceResponse[]>("/api/statistics/balance"),
        authenticatedRequest<PeriodStatisticsResponse>(`/api/statistics/summary?${query.toString()}`),
        authenticatedRequest<TransactionResponse[]>("/api/transactions?skip=0&limit=20"),
        authenticatedRequest<AccountResponse[]>("/api/accounts?skip=0&limit=300"),
        authenticatedRequest<CategoryResponse[]>("/api/categories?skip=0&limit=300"),
        authenticatedRequest<CurrencyResponse[]>("/api/currencies?skip=0&limit=300"),
      ]);

      setTotalBalance(totalData);
      setAccountBalances(balancesData);
      setSummary(summaryData);
      setRecentTransactions(sortByNewest(transactionsData).slice(0, 5));
      setAccounts(accountsData);
      setCategories(categoriesData);
      setCurrencies(currenciesData);
      if (currenciesData.length && !currenciesData.some((currency) => currency.code === selectedCurrency)) {
        setSelectedCurrency(currenciesData[0].code);
      }
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [authenticatedRequest, endDate, selectedCurrency, startDate]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const accountById = useMemo(() => new Map(accounts.map((account) => [account.id, account])), [accounts]);
  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  );

  const applyPreset = (nextPreset: PeriodPreset) => {
    setPreset(nextPreset);
    const range = getPresetRange(nextPreset);
    setStartDate(range.start);
    setEndDate(range.end);
  };

  return (
    <section className="space-y-3 pb-1">
      <SegmentedControl
        options={[
          { key: "7d", label: "7D" },
          { key: "30d", label: "30D" },
          { key: "month", label: "Month" },
        ]}
        value={preset}
        onChange={applyPreset}
      />

      <section className="mobile-card grid grid-cols-2 gap-2.5 p-3">
        <label className="text-xs font-semibold text-slate-600">
          From
          <input
            className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-sm"
            type="date"
            value={startDate}
            onChange={(event) => {
              setPreset("30d");
              setStartDate(event.target.value);
            }}
          />
        </label>
        <label className="text-xs font-semibold text-slate-600">
          To
          <input
            className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-sm"
            type="date"
            value={endDate}
            onChange={(event) => {
              setPreset("30d");
              setEndDate(event.target.value);
            }}
          />
        </label>

        <label className="col-span-2 text-xs font-semibold text-slate-600">
          Currency
          <select
            className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-sm"
            value={selectedCurrency}
            onChange={(event) => setSelectedCurrency(event.target.value)}
          >
            {currencies.map((currency) => (
              <option key={currency.id} value={currency.code}>
                {currency.code} ({currency.symbol})
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          className="col-span-2 rounded-xl bg-[var(--accent-primary)] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent-primary-strong)]"
          onClick={() => void loadDashboard()}
          disabled={isRefreshing}
        >
          {isRefreshing ? "Refreshing..." : "Refresh data"}
        </button>
      </section>

      {errorMessage ? <ErrorState message={errorMessage} /> : null}
      {isLoading ? <LoadingState message="Загружаем dashboard..." /> : null}

      {!isLoading ? (
        <section className="space-y-3 rounded-[24px] bg-[#172338] p-3">
          <BalanceHeroCard
            totalBalance={
              totalBalance
                ? formatAmount(totalBalance.total_balance, totalBalance.currency_code)
                : "$0.00"
            }
            income={summary ? formatAmount(summary.total_income, selectedCurrency) : "$0.00"}
            expenses={summary ? formatAmount(summary.total_expense, selectedCurrency) : "$0.00"}
          />

          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white/95">Payment Sources</h2>
              <Link href="/accounts" className="text-xs font-semibold text-indigo-300">
                View All
              </Link>
            </div>
            <div className="space-y-2">
              {accountBalances.slice(0, 2).map((account) => {
                const accountDetails = accountById.get(account.account_id);
                const suffix = accountDetails?.short_identifier
                  ? `****${accountDetails.short_identifier}`
                  : account.account_name;
                return (
                  <SourceCard
                    key={account.account_id}
                    name={account.account_name}
                    identifier={suffix}
                    amount={formatAmount(account.balance, account.currency_code)}
                  />
                );
              })}
            </div>
          </section>

          <section className="grid grid-cols-4 gap-2">
            <ActionTile
              label="Add"
              icon={Plus}
              iconClassName="bg-emerald-500/20 text-emerald-300"
              onClick={() => router.push("/transactions?create=1")}
            />
            <ActionTile
              label="Send"
              icon={Send}
              iconClassName="bg-rose-500/20 text-rose-300"
              onClick={() => router.push("/transactions?create=1")}
            />
            <ActionTile
              label="Transfer"
              icon={ArrowRightLeft}
              iconClassName="bg-indigo-500/20 text-indigo-300"
              onClick={() => router.push("/transactions?create=1")}
            />
            <ActionTile
              label="Budget"
              icon={WalletCards}
              iconClassName="bg-orange-500/20 text-orange-300"
              onClick={() => router.push("/analytics")}
            />
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white/95">Recent Transactions</h2>
              <Link href="/transactions" className="text-xs font-semibold text-indigo-300">
                See All
              </Link>
            </div>
            <div className="space-y-2">
              {recentTransactions.length ? (
                recentTransactions.map((transaction) => {
                  const account = accountById.get(transaction.account_id);
                  const category = transaction.category_id
                    ? categoryById.get(transaction.category_id)
                    : null;
                  return (
                    <TransactionRow
                      key={transaction.id}
                      name={category?.name ?? account?.name ?? "Transaction"}
                      subtitle={`${transaction.type} • ${account?.name ?? "Unknown source"}`}
                      amount={formatAmount(transaction.amount, selectedCurrency)}
                      dateLabel={formatDateLabel(transaction.transaction_date)}
                      type={transaction.type}
                      categoryIcon={category?.icon ?? null}
                    />
                  );
                })
              ) : (
                <p className="rounded-2xl border border-white/10 bg-[#1f2a40] px-3 py-3 text-sm text-white/70">
                  No transactions yet.
                </p>
              )}
            </div>
          </section>
        </section>
      ) : null}
    </section>
  );
}
