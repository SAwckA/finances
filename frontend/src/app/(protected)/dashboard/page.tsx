"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRightLeft,
  CalendarDays,
  ChevronLeft,
  ListChecks,
  Plus,
  Save,
  Send,
  WalletCards,
} from "lucide-react";
import { ErrorState, LoadingState } from "@/components/async-state";
import { ActionTile } from "@/components/ui/action-tile";
import { BalanceHeroCard } from "@/components/ui/balance-hero-card";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { SourceCard } from "@/components/ui/source-card";
import { TransactionRow } from "@/components/ui/transaction-row";
import { useAuth } from "@/features/auth/auth-context";
import { ApiError } from "@/lib/api-client";
import { getIconOption } from "@/lib/icon-catalog";
import type {
  AccountBalanceResponse,
  AccountResponse,
  CategoryResponse,
  CurrencyResponse,
  PeriodStatisticsResponse,
  TotalBalanceResponse,
  TransactionResponse,
  TransactionUpdate,
} from "@/lib/types";

type PeriodPreset = "7d" | "30d" | "custom";

type EditTransactionForm = {
  accountId: string;
  amount: string;
  description: string;
  transactionDate: string;
  categoryId: string;
};

const FEED_PAGE_SIZE = 20;

function toDateInputValue(date: Date): string {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function getPresetRange(preset: Exclude<PeriodPreset, "custom">): { start: string; end: string } {
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

  const startDate = new Date(now);
  startDate.setDate(now.getDate() - 29);
  return { start: toDateInputValue(startDate), end };
}

function toApiDate(date: string, endOfDay: boolean): string {
  const time = endOfDay ? "23:59:59" : "00:00:00";
  return new Date(`${date}T${time}`).toISOString();
}

function toLocalDateTimeValue(isoValue: string): string {
  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60_000;
    return new Date(now.getTime() - offset).toISOString().slice(0, 16);
  }

  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
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

function shortAccountBadge(account: AccountResponse | undefined): string | null {
  if (!account?.short_identifier) {
    return null;
  }

  return account.short_identifier;
}

function badgeStyle(color: string | undefined): React.CSSProperties | undefined {
  if (!color) {
    return undefined;
  }

  return {
    backgroundColor: `${color}1a`,
    borderColor: `${color}55`,
    color,
  };
}

function typeBadgeClass(type: TransactionResponse["type"]): string {
  if (type === "income") {
    return "border-emerald-400/30 bg-emerald-500/15 text-emerald-200";
  }
  if (type === "expense") {
    return "border-rose-400/30 bg-rose-500/15 text-rose-200";
  }
  return "border-sky-400/30 bg-sky-500/15 text-sky-200";
}

function typeBadgeStyle(type: TransactionResponse["type"]): React.CSSProperties {
  if (type === "income") {
    return { backgroundColor: "rgba(16,185,129,0.18)", borderColor: "rgba(16,185,129,0.4)", color: "#bbf7d0" };
  }
  if (type === "expense") {
    return { backgroundColor: "rgba(244,63,94,0.18)", borderColor: "rgba(244,63,94,0.4)", color: "#fecdd3" };
  }
  return { backgroundColor: "rgba(14,165,233,0.18)", borderColor: "rgba(14,165,233,0.4)", color: "#bae6fd" };
}

export default function DashboardPage() {
  const router = useRouter();
  const { authenticatedRequest } = useAuth();
  const [selectedCurrency, setSelectedCurrency] = useState("USD");
  const [preset, setPreset] = useState<PeriodPreset>("30d");
  const [showDateFilters, setShowDateFilters] = useState(false);
  const defaultRange = useMemo(() => getPresetRange("30d"), []);
  const [startDate, setStartDate] = useState(defaultRange.start);
  const [endDate, setEndDate] = useState(defaultRange.end);
  const [currencies, setCurrencies] = useState<CurrencyResponse[]>([]);
  const [totalBalance, setTotalBalance] = useState<TotalBalanceResponse | null>(null);
  const [accountBalances, setAccountBalances] = useState<AccountBalanceResponse[]>([]);
  const [summary, setSummary] = useState<PeriodStatisticsResponse | null>(null);
  const [accounts, setAccounts] = useState<AccountResponse[]>([]);
  const [categories, setCategories] = useState<CategoryResponse[]>([]);
  const [transactions, setTransactions] = useState<TransactionResponse[]>([]);
  const [hasMoreTransactions, setHasMoreTransactions] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isTransactionsLoading, setIsTransactionsLoading] = useState(true);
  const [isLoadingMoreTransactions, setIsLoadingMoreTransactions] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [editingTransactionId, setEditingTransactionId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<EditTransactionForm | null>(null);
  const [editErrorMessage, setEditErrorMessage] = useState<string | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const transactionOffsetRef = useRef(0);
  const range = useMemo(() => {
    if (preset !== "custom") {
      return getPresetRange(preset);
    }

    if (!startDate || !endDate) {
      return defaultRange;
    }

    return { start: startDate, end: endDate };
  }, [defaultRange, endDate, preset, startDate]);

  const accountById = useMemo(() => new Map(accounts.map((account) => [account.id, account])), [accounts]);
  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  );
  const currencyById = useMemo(
    () => new Map(currencies.map((currency) => [currency.id, currency])),
    [currencies],
  );

  const editingTransaction = useMemo(() => {
    if (!editingTransactionId) {
      return null;
    }

    return transactions.find((item) => item.id === editingTransactionId) ?? null;
  }, [editingTransactionId, transactions]);

  const editingCategories = useMemo(() => {
    if (!editingTransaction || editingTransaction.type === "transfer") {
      return [];
    }

    return categories.filter((category) => category.type === editingTransaction.type);
  }, [categories, editingTransaction]);

  const loadDashboardData = useCallback(async () => {
    setErrorMessage(null);
    setIsRefreshing(true);

    try {
      const query = new URLSearchParams({
        start_date: toApiDate(range.start, false),
        end_date: toApiDate(range.end, true),
      });

      const [totalData, balancesData, summaryData, accountsData, categoriesData, currenciesData] =
        await Promise.all([
          authenticatedRequest<TotalBalanceResponse>(
            `/api/statistics/total?currency=${encodeURIComponent(selectedCurrency)}`,
          ),
          authenticatedRequest<AccountBalanceResponse[]>("/api/statistics/balance"),
          authenticatedRequest<PeriodStatisticsResponse>(`/api/statistics/summary?${query.toString()}`),
          authenticatedRequest<AccountResponse[]>("/api/accounts?skip=0&limit=300"),
          authenticatedRequest<CategoryResponse[]>("/api/categories?skip=0&limit=300"),
          authenticatedRequest<CurrencyResponse[]>("/api/currencies?skip=0&limit=300"),
        ]);

      setTotalBalance(totalData);
      setAccountBalances(balancesData);
      setSummary(summaryData);
      setAccounts(accountsData);
      setCategories(categoriesData);
      setCurrencies(currenciesData);

      if (
        currenciesData.length > 0 &&
        !currenciesData.some((currency) => currency.code === selectedCurrency)
      ) {
        setSelectedCurrency(currenciesData[0].code);
      }
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [authenticatedRequest, range.end, range.start, selectedCurrency]);

  const loadTransactionsPage = useCallback(
    async (reset: boolean) => {
      if (reset) {
        setIsTransactionsLoading(true);
      } else {
        setIsLoadingMoreTransactions(true);
      }

      try {
        const nextOffset = reset ? 0 : transactionOffsetRef.current;
        const response = await authenticatedRequest<TransactionResponse[]>(
          `/api/transactions?skip=${nextOffset}&limit=${FEED_PAGE_SIZE}`,
        );

        const ordered = sortByNewest(response);
        setTransactions((prev) => {
          if (reset) {
            return ordered;
          }

          const seenIds = new Set(prev.map((item) => item.id));
          const appended = ordered.filter((item) => !seenIds.has(item.id));
          return [...prev, ...appended];
        });

        transactionOffsetRef.current = nextOffset + ordered.length;
        setHasMoreTransactions(ordered.length === FEED_PAGE_SIZE);
      } catch (error) {
        setErrorMessage(getErrorMessage(error));
      } finally {
        setIsTransactionsLoading(false);
        setIsLoadingMoreTransactions(false);
      }
    },
    [authenticatedRequest],
  );

  useEffect(() => {
    void loadDashboardData();
  }, [loadDashboardData]);

  useEffect(() => {
    transactionOffsetRef.current = 0;
    void loadTransactionsPage(true);
  }, [loadTransactionsPage, preset]);

  useEffect(() => {
    if (preset !== "custom") {
      setShowDateFilters(false);
    }
  }, [preset]);

  useEffect(() => {
    if (!hasMoreTransactions || isTransactionsLoading || isLoadingMoreTransactions) {
      return;
    }

    const node = loadMoreRef.current;
    if (!node) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) {
          return;
        }

        void loadTransactionsPage(false);
      },
      { rootMargin: "220px" },
    );

    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, [hasMoreTransactions, isLoadingMoreTransactions, isTransactionsLoading, loadTransactionsPage]);

  const openEditor = (transaction: TransactionResponse) => {
    setEditingTransactionId(transaction.id);
    setEditErrorMessage(null);
    setEditForm({
      accountId: String(transaction.account_id),
      amount: transaction.amount,
      description: transaction.description ?? "",
      transactionDate: toLocalDateTimeValue(transaction.transaction_date),
      categoryId: transaction.category_id ? String(transaction.category_id) : "",
    });
  };

  const closeEditor = () => {
    setEditingTransactionId(null);
    setEditForm(null);
    setEditErrorMessage(null);
  };

  const saveEditedTransaction = async () => {
    if (!editingTransaction || !editForm) {
      return;
    }

    if (!editForm.accountId) {
      setEditErrorMessage("Выберите счет.");
      return;
    }

    if (!editForm.amount || Number(editForm.amount) <= 0) {
      setEditErrorMessage("Укажите корректную сумму.");
      return;
    }

    setIsSavingEdit(true);
    setEditErrorMessage(null);

    try {
      const payload: TransactionUpdate = {
        account_id: Number(editForm.accountId),
        amount: Number(editForm.amount),
        description: editForm.description.trim() || null,
        transaction_date: new Date(editForm.transactionDate).toISOString(),
        category_id:
          editingTransaction.type === "transfer"
            ? null
            : editForm.categoryId
              ? Number(editForm.categoryId)
              : null,
      };

      await authenticatedRequest(`/api/transactions/${editingTransaction.id}`, {
        method: "PATCH",
        body: payload,
      });

      closeEditor();
      await Promise.all([loadDashboardData(), loadTransactionsPage(true)]);
    } catch (error) {
      setEditErrorMessage(getErrorMessage(error));
    } finally {
      setIsSavingEdit(false);
    }
  };

  const deleteEditedTransaction = async () => {
    if (!editingTransaction) {
      return;
    }

    const confirmed = window.confirm("Удалить транзакцию?");
    if (!confirmed) {
      return;
    }

    setIsSavingEdit(true);
    setEditErrorMessage(null);
    try {
      await authenticatedRequest(`/api/transactions/${editingTransaction.id}`, { method: "DELETE" });
      closeEditor();
      await Promise.all([loadDashboardData(), loadTransactionsPage(true)]);
    } catch (error) {
      setEditErrorMessage(getErrorMessage(error));
    } finally {
      setIsSavingEdit(false);
    }
  };

  return (
    <section className="space-y-3 pb-1">
      <section className="mobile-card grid grid-cols-1 gap-3 p-3">
        <BalanceHeroCard
          totalBalance={
            totalBalance
              ? formatAmount(totalBalance.total_balance, totalBalance.currency_code)
              : "$0.00"
          }
          income={summary ? formatAmount(summary.total_income, selectedCurrency) : "$0.00"}
          expenses={summary ? formatAmount(summary.total_expense, selectedCurrency) : "$0.00"}
        />

        <div className="grid grid-cols-[1fr_auto] items-end gap-2">
          <label className="text-xs font-semibold text-[var(--text-secondary)]">
            Currency
            <select
              className="mt-1 block w-full px-2.5 py-2 text-sm"
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
            className="rounded-xl bg-[var(--accent-primary)] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent-primary-strong)]"
            onClick={() => void loadDashboardData()}
            disabled={isRefreshing}
          >
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </section>

      {errorMessage ? <ErrorState message={errorMessage} /> : null}
      {isLoading ? <LoadingState message="Загружаем dashboard..." /> : null}

      {!isLoading ? (
        <section className="space-y-3">
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-lg font-bold text-[var(--text-primary)]">Payment Sources</h2>
              <Link href="/accounts" className="text-xs font-semibold text-[var(--accent-primary)]">
                View All
              </Link>
            </div>
            <div className="space-y-2">
              {accountBalances.slice(0, 2).map((account) => {
                const accountDetails = accountById.get(account.account_id);
                const badge = shortAccountBadge(accountDetails);
                return (
                  <SourceCard
                    key={account.account_id}
                    name={account.account_name}
                    identifier={
                      badge ? (
                        <span className="badge" style={badgeStyle(accountDetails?.color)}>
                          {badge}
                        </span>
                      ) : (
                        <span>No short id</span>
                      )
                    }
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
              iconClassName="bg-emerald-500/15 text-emerald-600"
              onClick={() => router.push("/transactions?create=1")}
            />
            <ActionTile
              label="Send"
              icon={Send}
              iconClassName="bg-rose-500/15 text-rose-600"
              onClick={() => router.push("/transactions?create=1")}
            />
            <ActionTile
              label="Transfer"
              icon={ArrowRightLeft}
              iconClassName="bg-sky-500/15 text-sky-600"
              onClick={() => router.push("/transactions?create=1")}
            />
            <ActionTile
              label="Budget"
              icon={WalletCards}
              iconClassName="bg-amber-500/15 text-amber-600"
              onClick={() => router.push("/analytics")}
            />
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="text-lg font-bold text-[var(--text-primary)]">Recent Transactions</h2>
              <div className="w-[200px]">
                <SegmentedControl
                  options={[
                    { key: "7d", label: "7D" },
                    { key: "30d", label: "30D" },
                    {
                      key: "custom",
                      label: (
                        <span className="inline-flex items-center justify-center">
                          <CalendarDays className="h-4 w-4" />
                          <span className="sr-only">Dates</span>
                        </span>
                      ),
                    },
                  ]}
                  value={preset}
                  onChange={(nextPreset) => {
                    if (nextPreset === "custom") {
                      setShowDateFilters((prev) => (preset === "custom" ? !prev : true));
                    } else {
                      setShowDateFilters(false);
                    }
                    setPreset(nextPreset);
                  }}
                />
              </div>
            </div>

            {showDateFilters ? (
              <section className="mb-2 grid grid-cols-2 gap-2 rounded-2xl border border-[color:var(--border-soft)] bg-[var(--bg-card)] p-2.5">
                <label className="text-xs font-semibold text-[var(--text-secondary)]">
                  From
                  <input
                    className="mt-1 block w-full px-2.5 py-2 text-sm"
                    type="date"
                    value={startDate}
                    onChange={(event) => {
                      setPreset("custom");
                      setStartDate(event.target.value);
                    }}
                  />
                </label>
                <label className="text-xs font-semibold text-[var(--text-secondary)]">
                  To
                  <input
                    className="mt-1 block w-full px-2.5 py-2 text-sm"
                    type="date"
                    value={endDate}
                    onChange={(event) => {
                      setPreset("custom");
                      setEndDate(event.target.value);
                    }}
                  />
                </label>
              </section>
            ) : null}

            <div className="space-y-2">
              {isTransactionsLoading ? <LoadingState message="Загружаем операции..." /> : null}

              {!isTransactionsLoading && transactions.length === 0 ? (
                <p className="rounded-2xl border border-[color:var(--border-soft)] bg-[var(--bg-card)] px-3 py-3 text-sm text-[var(--text-secondary)]">
                  No transactions yet.
                </p>
              ) : null}

              {transactions.map((transaction) => {
                const account = accountById.get(transaction.account_id);
                const targetAccount = transaction.target_account_id
                  ? accountById.get(transaction.target_account_id)
                  : undefined;
                const category = transaction.category_id
                  ? categoryById.get(transaction.category_id)
                  : null;
                const accountCurrency = account
                  ? currencyById.get(account.currency_id)?.code ?? selectedCurrency
                  : selectedCurrency;
                const fromBadge = shortAccountBadge(account);
                const toBadge = shortAccountBadge(targetAccount);
                const subtitle =
                  transaction.type === "transfer" ? (
                    <>
                      {fromBadge ? (
                        <span className="badge" style={badgeStyle(account?.color)}>
                          {fromBadge}
                        </span>
                      ) : null}
                      <span className="text-[var(--text-secondary)]">→</span>
                      {toBadge ? (
                        <span className="badge" style={badgeStyle(targetAccount?.color)}>
                          {toBadge}
                        </span>
                      ) : null}
                    </>
                  ) : fromBadge ? (
                    <span className="badge" style={badgeStyle(account?.color)}>
                      {fromBadge}
                    </span>
                  ) : null;
                const shoppingBadge = transaction.shopping_list_id ? (
                  <span className="badge">
                    <ListChecks className="h-3 w-3" />
                    List
                  </span>
                ) : null;

                return (
                  <button
                    key={transaction.id}
                    type="button"
                    className="block w-full text-left"
                    onClick={() => openEditor(transaction)}
                  >
                    <TransactionRow
                      name={category?.name ?? account?.name ?? "Transaction"}
                      subtitle={subtitle}
                      amount={formatAmount(transaction.amount, accountCurrency)}
                      dateLabel={formatDateLabel(transaction.transaction_date)}
                      type={transaction.type}
                      categoryIcon={category?.icon ?? null}
                      metaBadge={shoppingBadge}
                      className="surface-hover"
                    />
                  </button>
                );
              })}

              {isLoadingMoreTransactions ? (
                <LoadingState message="Загружаем еще операции..." />
              ) : null}

              <div ref={loadMoreRef} className="h-1" />
            </div>
          </section>
        </section>
      ) : null}

      {editingTransaction && editForm ? (
        <section className="fixed inset-0 z-50 bg-[var(--bg-app)]">
          <div className="mx-auto flex h-full w-full max-w-[430px] flex-col">
            <header className="sticky top-0 z-10 border-b border-[color:var(--border-soft)] bg-[color:color-mix(in_srgb,var(--bg-app)_85%,transparent)] px-3 py-2.5 backdrop-blur">
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={closeEditor}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[color:var(--border-soft)] bg-[var(--bg-card)] text-[var(--text-secondary)]"
                  aria-label="Back"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <h2 className="text-base font-bold text-[var(--text-primary)]">Edit Transaction</h2>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-xl bg-[var(--accent-primary)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-70"
                  onClick={() => void saveEditedTransaction()}
                  disabled={isSavingEdit}
                >
                  <Save className="h-4 w-4" />
                  {isSavingEdit ? "Saving..." : "Save"}
                </button>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto px-3 py-3">
              <section className="space-y-3">
                <div className="mobile-card space-y-3 p-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-[var(--text-primary)]">Details</div>
                    <span
                      className={`badge ${typeBadgeClass(editingTransaction.type)}`}
                      style={typeBadgeStyle(editingTransaction.type)}
                    >
                      {editingTransaction.type === "income"
                        ? "Income"
                        : editingTransaction.type === "expense"
                          ? "Expense"
                          : "Transfer"}
                    </span>
                  </div>

                  <label className="block text-sm text-[var(--text-secondary)]">
                    <div className="flex items-center justify-between gap-2">
                      <span>Account</span>
                      {(() => {
                        const selectedAccount = accounts.find(
                          (account) => String(account.id) === editForm.accountId,
                        );
                        const currency = selectedAccount
                          ? currencyById.get(selectedAccount.currency_id)
                          : null;
                        const badge = shortAccountBadge(selectedAccount);
                        return (
                          <div className="flex items-center gap-2">
                            {selectedAccount?.color ? (
                              <span
                                className="h-2.5 w-2.5 rounded-full border"
                                style={{
                                  backgroundColor: selectedAccount.color,
                                  borderColor: selectedAccount.color,
                                }}
                              />
                            ) : null}
                            {badge ? (
                              <span className="badge" style={badgeStyle(selectedAccount?.color)}>
                                {badge}
                              </span>
                            ) : null}
                            <span className="text-xs text-[var(--text-secondary)]">
                              {currency ? `${currency.code} · ${currency.symbol}` : "Currency unknown"}
                            </span>
                          </div>
                        );
                      })()}
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {accounts.map((account) => {
                        const selected = String(account.id) === editForm.accountId;
                        const Icon = getIconOption(account.icon).icon;
                        const badge = shortAccountBadge(account);
                        return (
                          <button
                            key={account.id}
                            type="button"
                            className={`flex items-center gap-2 rounded-2xl border px-3 py-2.5 text-left transition ${
                              selected
                                ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/10"
                                : "border-[color:var(--border-soft)] bg-[var(--bg-card)]"
                            }`}
                            onClick={() =>
                              setEditForm((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      accountId: String(account.id),
                                    }
                                  : prev,
                              )
                            }
                          >
                            <span
                              className="inline-flex h-9 w-9 items-center justify-center rounded-xl"
                              style={{
                                backgroundColor: `${account.color}22`,
                                color: account.color,
                              }}
                            >
                              <Icon className="h-4.5 w-4.5" />
                            </span>
                            <div className="min-w-0">
                              {badge ? (
                                <span className="badge" style={badgeStyle(account.color)}>
                                  {badge}
                                </span>
                              ) : (
                                <span className="text-xs text-[var(--text-secondary)]">No ID</span>
                              )}
                              <span className="mt-1 block text-xs text-[var(--text-secondary)]">
                                {(() => {
                                  const balance = accountBalances.find(
                                    (item) => item.account_id === account.id,
                                  );
                                  if (!balance) {
                                    return "Balance unknown";
                                  }
                                  return formatAmount(balance.balance, balance.currency_code);
                                })()}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </label>

                  <label className="block text-sm text-[var(--text-secondary)]">
                    Amount
                    <input
                      className="mt-1 block w-full px-3 py-2 text-sm"
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={editForm.amount}
                      onChange={(event) =>
                        setEditForm((prev) =>
                          prev
                            ? {
                                ...prev,
                                amount: event.target.value,
                              }
                            : prev,
                        )
                      }
                    />
                  </label>

                  {editingTransaction.type !== "transfer" ? (
                    <label className="block text-sm text-[var(--text-secondary)]">
                      Category
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          className={`flex items-center gap-2 rounded-2xl border px-3 py-2.5 text-left transition ${
                            editForm.categoryId === ""
                              ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/10"
                              : "border-[color:var(--border-soft)] bg-[var(--bg-card)]"
                          }`}
                          onClick={() =>
                            setEditForm((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    categoryId: "",
                                  }
                                : prev,
                            )
                          }
                        >
                          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                            <span className="text-xs font-semibold">—</span>
                          </span>
                          <span className="text-sm font-semibold text-[var(--text-primary)]">
                            Without category
                          </span>
                        </button>
                        {editingCategories.map((category) => {
                          const selected = String(category.id) === editForm.categoryId;
                          const Icon = getIconOption(category.icon).icon;
                          return (
                            <button
                              key={category.id}
                              type="button"
                              className={`flex items-center gap-2 rounded-2xl border px-3 py-2.5 text-left transition ${
                                selected
                                  ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/10"
                                  : "border-[color:var(--border-soft)] bg-[var(--bg-card)]"
                              }`}
                              onClick={() =>
                                setEditForm((prev) =>
                                  prev
                                    ? {
                                        ...prev,
                                        categoryId: String(category.id),
                                      }
                                    : prev,
                                )
                              }
                            >
                              <span
                                className="inline-flex h-9 w-9 items-center justify-center rounded-xl"
                                style={{
                                  backgroundColor: `${category.color}22`,
                                  color: category.color,
                                }}
                              >
                                <Icon className="h-4.5 w-4.5" />
                              </span>
                              <span className="text-sm font-semibold text-[var(--text-primary)]">
                                {category.name}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </label>
                  ) : null}

                  <label className="block text-sm text-[var(--text-secondary)]">
                    Description
                    <input
                      className="mt-1 block w-full px-3 py-2 text-sm"
                      value={editForm.description}
                      onChange={(event) =>
                        setEditForm((prev) =>
                          prev
                            ? {
                                ...prev,
                                description: event.target.value,
                              }
                            : prev,
                        )
                      }
                    />
                  </label>

                  <label className="block text-sm text-[var(--text-secondary)]">
                    Date and time
                    <input
                      className="mt-1 block w-full px-3 py-2 text-sm"
                      type="datetime-local"
                      value={editForm.transactionDate}
                      onChange={(event) =>
                        setEditForm((prev) =>
                          prev
                            ? {
                                ...prev,
                                transactionDate: event.target.value,
                              }
                            : prev,
                        )
                      }
                    />
                  </label>

                  {editErrorMessage ? <ErrorState message={editErrorMessage} /> : null}
                </div>

                {editingTransaction.shopping_list_id ? (
                  <section className="mobile-card flex items-center justify-between gap-3 p-3">
                    <div>
                      <p className="text-sm font-semibold text-[var(--text-primary)]">Shopping list</p>
                      <p className="text-xs text-[var(--text-secondary)]">
                        List ID: {editingTransaction.shopping_list_id}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="rounded-xl border border-[color:var(--border-soft)] bg-[var(--bg-card)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)]"
                      onClick={() => router.push(`/shopping-lists?open=${editingTransaction.shopping_list_id}`)}
                    >
                      Open
                    </button>
                  </section>
                ) : null}

                <section className="mobile-card p-3">
                  <button
                    type="button"
                    className="w-full rounded-xl bg-rose-50 px-3 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 dark:bg-rose-500/15 dark:text-rose-200 dark:hover:bg-rose-500/25"
                    onClick={() => void deleteEditedTransaction()}
                    disabled={isSavingEdit}
                  >
                    Delete transaction
                  </button>
                </section>
              </section>
            </div>
          </div>
        </section>
      ) : null}
    </section>
  );
}
