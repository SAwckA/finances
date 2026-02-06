"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRightLeft,
  CalendarDays,
  ListChecks,
  Plus,
  Send,
  WalletCards,
} from "lucide-react";
import { ErrorState, LoadingState } from "@/components/async-state";
import { ActionTile } from "@/components/ui/action-tile";
import { BalanceHeroCard } from "@/components/ui/balance-hero-card";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { SourceCard } from "@/components/ui/source-card";
import { TransactionRow } from "@/components/ui/transaction-row";
import { TransactionFormFields } from "@/components/transactions/transaction-form-fields";
import { TransactionEditorHeader } from "@/components/transactions/transaction-editor-header";
import { useAuth } from "@/features/auth/auth-context";
import { ApiError } from "@/lib/api-client";
import type {
  AccountBalanceResponse,
  AccountResponse,
  CategoryResponse,
  CurrencyResponse,
  PeriodStatisticsResponse,
  ShoppingListResponse,
  TotalBalanceResponse,
  TransactionResponse,
  TransactionUpdate,
} from "@/lib/types";

type PeriodPreset = "7d" | "30d" | "custom";

type EditTransactionForm = {
  accountId: string;
  targetAccountId: string;
  amount: string;
  targetAmount: string;
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

function parsePositiveAmount(rawValue: string): number | null {
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
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
    return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-500/15 dark:text-emerald-200";
  }
  if (type === "expense") {
    return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/30 dark:bg-rose-500/15 dark:text-rose-200";
  }
  return "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-400/30 dark:bg-sky-500/15 dark:text-sky-200";
}

export default function DashboardPage() {
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
  const [showAllSources, setShowAllSources] = useState(false);
  const [selectedAccountIds, setSelectedAccountIds] = useState<number[]>([]);
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
  const [shoppingListDetails, setShoppingListDetails] = useState<ShoppingListResponse | null>(null);
  const [isShoppingListLoading, setIsShoppingListLoading] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();
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
    () => new Map(currencies.map((currency) => [currency.code, currency])),
    [currencies],
  );
  const accountCurrencies = useMemo(() => {
    const seen = new Set<string>();
    const ordered: CurrencyResponse[] = [];
    accounts.forEach((account) => {
      const currency = currencyById.get(account.currency_code);
      if (!currency || seen.has(currency.code)) {
        return;
      }
      seen.add(currency.code);
      ordered.push(currency);
    });
    return ordered;
  }, [accounts, currencyById]);
  const filteredTransactions = useMemo(() => {
    if (selectedAccountIds.length === 0) {
      return transactions;
    }

    const selectedSet = new Set(selectedAccountIds);
    return transactions.filter(
      (transaction) =>
        selectedSet.has(transaction.account_id) ||
        (transaction.target_account_id ? selectedSet.has(transaction.target_account_id) : false),
    );
  }, [selectedAccountIds, transactions]);

  const editingTransaction = useMemo(() => {
    if (!editingTransactionId) {
      return null;
    }

    return transactions.find((item) => item.id === editingTransactionId) ?? null;
  }, [editingTransactionId, transactions]);

  const toggleAccountSelection = useCallback((accountId: number) => {
    setSelectedAccountIds((prev) =>
      prev.includes(accountId) ? prev.filter((id) => id !== accountId) : [...prev, accountId],
    );
  }, []);

  useEffect(() => {
    const accountsParam = searchParams.get("accounts");
    if (!accountsParam) {
      setSelectedAccountIds((prev) => (prev.length === 0 ? prev : []));
      return;
    }

    const nextIds = accountsParam
      .split(",")
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value));
    setSelectedAccountIds((prev) => {
      if (prev.length === nextIds.length && prev.every((value, index) => value === nextIds[index])) {
        return prev;
      }
      return nextIds;
    });
  }, [searchParams]);

  useEffect(() => {
    const nextParams = new URLSearchParams(searchParams.toString());
    if (selectedAccountIds.length > 0) {
      nextParams.set("accounts", selectedAccountIds.join(","));
    } else {
      nextParams.delete("accounts");
    }
    const nextQuery = nextParams.toString();
    const currentQuery = searchParams.toString();
    if (nextQuery === currentQuery) {
      return;
    }
    const nextUrl = nextQuery ? `?${nextQuery}` : window.location.pathname;
    router.replace(nextUrl, { scroll: false });
  }, [router, searchParams, selectedAccountIds]);

  const loadDashboardData = useCallback(async () => {
    setErrorMessage(null);
    setIsRefreshing(true);

    try {
      const query = new URLSearchParams({
        start_date: toApiDate(range.start, false),
        end_date: toApiDate(range.end, true),
      });
      query.set("currency", selectedCurrency);
      if (selectedAccountIds.length > 0) {
        selectedAccountIds.forEach((accountId) => query.append("account_ids", String(accountId)));
      }

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
  }, [authenticatedRequest, range.end, range.start, selectedAccountIds, selectedCurrency]);

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
  }, [loadDashboardData, preset, selectedCurrency, startDate, endDate, selectedAccountIds]);

  useEffect(() => {
    if (!editingTransaction) {
      return;
    }

    const scrollY = window.scrollY;
    const { body } = document;
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";

    return () => {
      const top = body.style.top;
      body.style.position = "";
      body.style.top = "";
      body.style.width = "";
      const restored = top ? Number.parseInt(top.replace("px", ""), 10) : 0;
      window.scrollTo(0, Math.abs(restored));
    };
  }, [editingTransaction]);

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
      targetAccountId: transaction.target_account_id ? String(transaction.target_account_id) : "",
      amount: transaction.amount,
      targetAmount: transaction.type === "transfer" ? transaction.converted_amount ?? "" : "",
      description: transaction.description ?? "",
      transactionDate: toLocalDateTimeValue(transaction.transaction_date),
      categoryId: transaction.category_id ? String(transaction.category_id) : "",
    });
  };

  const closeEditor = () => {
    setEditingTransactionId(null);
    setEditForm(null);
    setEditErrorMessage(null);
    setShoppingListDetails(null);
  };

  useEffect(() => {
    if (!editingTransaction?.shopping_list_id) {
      setShoppingListDetails(null);
      return;
    }

    let active = true;
    const loadShoppingList = async () => {
      setIsShoppingListLoading(true);
      try {
        const data = await authenticatedRequest<ShoppingListResponse>(
          `/api/shopping-lists/${editingTransaction.shopping_list_id}`,
        );
        if (active) {
          setShoppingListDetails(data);
        }
      } catch {
        if (active) {
          setShoppingListDetails(null);
        }
      } finally {
        if (active) {
          setIsShoppingListLoading(false);
        }
      }
    };

    void loadShoppingList();
    return () => {
      active = false;
    };
  }, [authenticatedRequest, editingTransaction?.shopping_list_id]);

  const saveEditedTransaction = async () => {
    if (!editingTransaction || !editForm) {
      return;
    }

    if (!editForm.accountId) {
      setEditErrorMessage("Выберите счет.");
      return;
    }

    if (!editForm.accountId) {
      setEditErrorMessage("Выберите счет.");
      return;
    }

    if (editingTransaction.type === "transfer" && !editForm.targetAccountId) {
      setEditErrorMessage("Для перевода нужно выбрать целевой счет.");
      return;
    }

    const parsedAmount = parsePositiveAmount(editForm.amount);
    if (parsedAmount === null) {
      setEditErrorMessage("Укажите корректную сумму.");
      return;
    }

    setIsSavingEdit(true);
    setEditErrorMessage(null);

    try {
      const payload: TransactionUpdate = {
        account_id: Number(editForm.accountId),
        target_account_id:
          editingTransaction.type === "transfer" ? Number(editForm.targetAccountId) : null,
        amount: parsedAmount,
        description: editForm.description.trim() || null,
        transaction_date: new Date(editForm.transactionDate).toISOString(),
        category_id:
          editingTransaction.type === "transfer"
            ? null
            : editForm.categoryId
              ? Number(editForm.categoryId)
              : null,
      };

      const query = new URLSearchParams();
      if (editingTransaction.type === "transfer" && editForm.targetAmount) {
        const sourceAmount = Number(editForm.amount);
        const targetAmount = Number(editForm.targetAmount);
        if (Number.isFinite(sourceAmount) && sourceAmount > 0 && Number.isFinite(targetAmount)) {
          query.set("converted_amount", targetAmount.toString());
          query.set("exchange_rate", (targetAmount / sourceAmount).toString());
        }
      }
      const url = query.toString()
        ? `/api/transactions/${editingTransaction.id}?${query.toString()}`
        : `/api/transactions/${editingTransaction.id}`;

      await authenticatedRequest(url, {
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

        <div className="flex flex-wrap justify-center gap-1.5">
            {accountCurrencies.map((currency) => {
              const active = currency.code === selectedCurrency;
              return (
                <button
                  key={currency.code}
                  type="button"
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring-primary)] ${
                    active
                      ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]"
                      : "border-[color:var(--border-soft)] bg-[var(--bg-card)] text-[var(--text-secondary)]"
                  }`}
                  onClick={() => setSelectedCurrency(currency.code)}
                >
                  {currency.code}
                </button>
              );
            })}
        </div>
      </section>

      {errorMessage ? <ErrorState message={errorMessage} /> : null}
      {isLoading ? <LoadingState message="Загружаем dashboard…" /> : null}

      {!isLoading ? (
        <section className="space-y-3">
          <section className="grid grid-cols-4 gap-2">
            <ActionTile
              label="Add"
              icon={Plus}
              iconClassName="bg-emerald-500/15 text-emerald-600"
              href="/transactions?create=1&type=income"
            />
            <ActionTile
              label="Send"
              icon={Send}
              iconClassName="bg-rose-500/15 text-rose-600"
              href="/transactions?create=1&type=expense"
            />
            <ActionTile
              label="Transfer"
              icon={ArrowRightLeft}
              iconClassName="bg-sky-500/15 text-sky-600"
              href="/transactions?create=1&type=transfer"
            />
            <ActionTile
              label="Shopping list"
              icon={WalletCards}
              iconClassName="bg-amber-500/15 text-amber-600"
              href="/shopping-lists"
            />
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-lg font-bold text-[var(--text-primary)]">Payment Sources</h2>
              {accountBalances.length > 2 ? (
                <button
                  type="button"
                  className="text-xs font-semibold text-[var(--accent-primary)] transition hover:text-[var(--accent-primary-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]/40"
                  onClick={() => setShowAllSources((prev) => !prev)}
                >
                  {showAllSources ? "Show Less" : "Show All"}
                </button>
              ) : null}
            </div>
            <div className="space-y-2">
              {(showAllSources ? accountBalances : accountBalances.slice(0, 2)).map((account) => {
                const accountDetails = accountById.get(account.account_id);
                const badge = shortAccountBadge(accountDetails);
                  return (
                    <SourceCard
                      key={account.account_id}
                      name={account.account_name}
                      icon={accountDetails?.icon ?? null}
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
                    tone={accountDetails?.color}
                    selected={selectedAccountIds.includes(account.account_id)}
                    onClick={() => toggleAccountSelection(account.account_id)}
                  />
                );
              })}
            </div>
            {selectedAccountIds.length > 0 ? (
              <div className="mt-2 flex items-center justify-between rounded-2xl border border-[color:var(--border-soft)] bg-[var(--bg-card)] px-3 py-2 text-xs text-[var(--text-secondary)]">
                <span>Filtering by {selectedAccountIds.length} account(s)</span>
                <button
                  type="button"
                  className="font-semibold text-[var(--accent-primary)] transition hover:text-[var(--accent-primary-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]/40"
                  onClick={() => {
                    setSelectedAccountIds([]);
                  }}
                >
                  Clear
                </button>
              </div>
            ) : null}
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
                    name="startDate"
                    autoComplete="off"
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
                    name="endDate"
                    autoComplete="off"
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
              {isTransactionsLoading ? <LoadingState message="Загружаем операции…" /> : null}

              {!isTransactionsLoading && filteredTransactions.length === 0 ? (
                <p className="rounded-2xl border border-[color:var(--border-soft)] bg-[var(--bg-card)] px-3 py-3 text-sm text-[var(--text-secondary)]">
                  {selectedAccountIds.length > 0
                    ? "No transactions for selected accounts."
                    : "No transactions yet."}
                </p>
              ) : null}

              {filteredTransactions.map((transaction) => {
                const account = accountById.get(transaction.account_id);
                const targetAccount = transaction.target_account_id
                  ? accountById.get(transaction.target_account_id)
                  : undefined;
                const category = transaction.category_id
                  ? categoryById.get(transaction.category_id)
                  : null;
                const accountCurrency = account
                  ? currencyById.get(account.currency_code)?.code ?? selectedCurrency
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
                    <ListChecks className="h-3 w-3" aria-hidden="true" />
                    List
                  </span>
                ) : null;

                return (
                  <button
                    key={transaction.id}
                    type="button"
                    className="block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]/30"
                    onClick={() => openEditor(transaction)}
                  >
                    <TransactionRow
                      name={category?.name ?? account?.name ?? "Transaction"}
                      subtitle={subtitle}
                      amount={formatAmount(transaction.amount, accountCurrency)}
                      dateLabel={formatDateLabel(transaction.transaction_date)}
                      type={transaction.type}
                      categoryIcon={category?.icon ?? null}
                      categoryColor={category?.color ?? null}
                      metaBadge={shoppingBadge}
                      className="surface-hover"
                    />
                  </button>
                );
              })}

              {isLoadingMoreTransactions ? (
                <LoadingState message="Загружаем еще операции…" />
              ) : null}

              <div ref={loadMoreRef} className="h-1" />
            </div>
          </section>
        </section>
      ) : null}

      {editingTransaction && editForm ? (
        <section className="fixed inset-0 z-50 overscroll-contain bg-[var(--bg-app)]">
          <div className="mx-auto flex h-full w-full max-w-[430px] flex-col">
            <TransactionEditorHeader
              title="Edit Transaction"
              onBack={closeEditor}
              onSave={() => void saveEditedTransaction()}
              isSaving={isSavingEdit}
            />

            <div className="flex-1 overflow-y-auto px-3 py-3">
              <section className="space-y-3">
                <div className="mobile-card space-y-3 p-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-[var(--text-primary)]">Details</div>
                    <span className={`badge ${typeBadgeClass(editingTransaction.type)}`}>
                      {editingTransaction.type === "income"
                        ? "Income"
                        : editingTransaction.type === "expense"
                          ? "Expense"
                          : "Transfer"}
                    </span>
                  </div>

                  <TransactionFormFields
                    form={editForm}
                    setForm={setEditForm}
                    transactionType={editingTransaction.type}
                    accounts={accounts}
                    accountBalances={accountBalances}
                    categories={categories}
                    currencies={currencies}
                    showTypeSelector={false}
                  />

                  {editErrorMessage ? <ErrorState message={editErrorMessage} /> : null}
                </div>

                {editingTransaction.shopping_list_id ? (
                  <section className="mobile-card space-y-2 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--surface-hover)] text-[var(--text-secondary)]">
                          <ListChecks className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <p className="text-sm font-semibold text-[var(--text-primary)]">
                          {shoppingListDetails?.name ?? "Список покупок"}
                        </p>
                      </div>
                      <Link
                        href={`/shopping-lists/${editingTransaction.shopping_list_id}`}
                        className="rounded-xl border border-[color:var(--border-soft)] bg-[var(--bg-card)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] transition hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]/30"
                      >
                        Open
                      </Link>
                    </div>
                    {isShoppingListLoading ? (
                      <LoadingState message="Загружаем список покупок…" />
                    ) : null}
                    {!isShoppingListLoading && shoppingListDetails ? (
                      <ul className="space-y-1">
                          {shoppingListDetails.items.length === 0 ? (
                            <li className="text-xs text-[var(--text-secondary)]">Список пуст.</li>
                          ) : (
                            shoppingListDetails.items.map((item, index) => (
                              <li
                                key={item.id}
                                className="flex items-baseline gap-2 text-sm text-[var(--text-secondary)]"
                              >
                                <span className="text-[var(--text-primary)]">
                                  {index + 1}.
                                </span>
                                <span className="truncate text-[var(--text-primary)]">
                                  {item.name}
                                </span>
                                <span className="mx-1 flex-1 border-b border-dotted border-[color:var(--border-soft)]" />
                                <span className="shrink-0 text-[var(--text-secondary)]">
                                  {item.quantity} шт.
                                </span>
                              </li>
                            ))
                          )}
                      </ul>
                    ) : null}
                    {!isShoppingListLoading && !shoppingListDetails ? (
                      <p className="text-xs text-[var(--text-secondary)]">Список покупок не найден.</p>
                    ) : null}
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
