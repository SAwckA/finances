"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRightLeft, ListChecks, Plus, Repeat, Send, WalletCards } from "lucide-react";
import { ErrorState, LoadingState } from "@/components/async-state";
import { UiActionTile } from "@/components/ui/ui-action-tile";
import { UiAccountSelectTile } from "@/components/ui/ui-account-select-tile";
import { UiBalanceSummaryCard } from "@/components/ui/ui-balance-summary-card";
import { UiChip } from "@/components/ui/ui-chip";
import { UiDateRangeField } from "@/components/ui/ui-date-range-field";
import { UiInlineAction } from "@/components/ui/ui-inline-action";
import { UiSegmentedControl } from "@/components/ui/ui-segmented-control";
import { UiTransactionTile } from "@/components/ui/ui-transaction-tile";
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

const FEED_PAGE_SIZE = 20;
const DASHBOARD_SCROLL_STATE_KEY = "dashboard:return-state";
const DASHBOARD_CURRENCY_STORAGE_KEY = "dashboard:selected-currency";

type DashboardScrollState = {
  scrollY: number;
  loadedTransactions: number;
};

function toDateInputValue(date: Date): string {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function getDefaultRange(): { start: string; end: string } {
  const now = new Date();
  const end = toDateInputValue(now);

  const startDate = new Date(now);
  startDate.setDate(now.getDate() - 29);
  return { start: toDateInputValue(startDate), end };
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
    return "Неизвестно";
  }

  const today = new Date();
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const startDate = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const diffDays = Math.round((startToday - startDate) / 86_400_000);

  if (diffDays <= 0) {
    return "Сегодня";
  }
  if (diffDays === 1) {
    return "Вчера";
  }
  if (diffDays <= 6) {
    return `${diffDays} дн. назад`;
  }

  return new Intl.DateTimeFormat("ru-RU", { month: "short", day: "numeric" }).format(date);
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

function pickInitialCurrency(
  accounts: AccountResponse[],
  currencies: CurrencyResponse[],
  currentCurrency: string,
): string {
  const available = new Set(currencies.map((currency) => currency.code));
  if (currentCurrency && available.has(currentCurrency)) {
    return currentCurrency;
  }

  if (typeof window !== "undefined") {
    const stored = window.localStorage.getItem(DASHBOARD_CURRENCY_STORAGE_KEY);
    if (stored && available.has(stored)) {
      return stored;
    }
  }

  const accountCurrencies = Array.from(new Set(accounts.map((account) => account.currency_code))).filter((code) =>
    available.has(code),
  );
  if (accountCurrencies.length > 0) {
    const randomIndex = Math.floor(Math.random() * accountCurrencies.length);
    return accountCurrencies[randomIndex];
  }

  return currencies[0]?.code ?? "";
}

export default function DashboardPage() {
  const { authenticatedRequest } = useAuth();
  const tileFieldClassNames = {
    label: "text-default-600",
    inputWrapper:
      "border-0 bg-gradient-to-br from-content2/80 to-content1 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_10px_22px_rgba(2,6,23,0.18)] data-[hover=true]:bg-gradient-to-br data-[hover=true]:from-content2/90 data-[hover=true]:to-content1",
    input: "text-[var(--text-primary)]",
    innerWrapper: "text-[var(--text-primary)]",
  } as const;
  const [selectedCurrency, setSelectedCurrency] = useState("");
  const defaultRange = useMemo(() => getDefaultRange(), []);
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
  const [, setIsRefreshing] = useState(false);
  const [isTransactionsLoading, setIsTransactionsLoading] = useState(true);
  const [isLoadingMoreTransactions, setIsLoadingMoreTransactions] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingScrollRestore, setPendingScrollRestore] = useState<DashboardScrollState | null>(null);

  const router = useRouter();
  const searchParams = useSearchParams();
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const transactionOffsetRef = useRef(0);
  const range = useMemo(
    () => ({
      start: startDate || defaultRange.start,
      end: endDate || defaultRange.end,
    }),
    [defaultRange.end, defaultRange.start, endDate, startDate],
  );

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
  const currencyOptions = useMemo(
    () => accountCurrencies.map((currency) => ({ key: currency.code, label: currency.code })),
    [accountCurrencies],
  );
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

  const toggleAccountSelection = useCallback((accountId: number) => {
    setSelectedAccountIds((prev) =>
      prev.includes(accountId) ? prev.filter((id) => id !== accountId) : [...prev, accountId],
    );
  }, []);

  useEffect(() => {
    if (!selectedCurrency || typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(DASHBOARD_CURRENCY_STORAGE_KEY, selectedCurrency);
  }, [selectedCurrency]);

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
      const [balancesData, accountsData, categoriesData, currenciesData] = await Promise.all([
        authenticatedRequest<AccountBalanceResponse[]>("/api/statistics/balance"),
        authenticatedRequest<AccountResponse[]>("/api/accounts?skip=0&limit=300"),
        authenticatedRequest<CategoryResponse[]>("/api/categories?skip=0&limit=300"),
        authenticatedRequest<CurrencyResponse[]>("/api/currencies?skip=0&limit=300"),
      ]);

      const effectiveCurrency = pickInitialCurrency(accountsData, currenciesData, selectedCurrency);
      if (effectiveCurrency && effectiveCurrency !== selectedCurrency) {
        setSelectedCurrency(effectiveCurrency);
      }

      const query = new URLSearchParams({
        start_date: toApiDate(range.start, false),
        end_date: toApiDate(range.end, true),
      });
      if (effectiveCurrency) {
        query.set("currency", effectiveCurrency);
      }
      if (selectedAccountIds.length > 0) {
        selectedAccountIds.forEach((accountId) => query.append("account_ids", String(accountId)));
      }

      const [totalData, summaryData] = await Promise.all([
        authenticatedRequest<TotalBalanceResponse>(
          `/api/statistics/total?currency=${encodeURIComponent(effectiveCurrency)}`,
        ),
        authenticatedRequest<PeriodStatisticsResponse>(`/api/statistics/summary?${query.toString()}`),
      ]);

      setTotalBalance(totalData);
      setSummary(summaryData);
      setAccountBalances(balancesData);
      setAccounts(accountsData);
      setCategories(categoriesData);
      setCurrencies(currenciesData);
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
    const savedState = window.sessionStorage.getItem(DASHBOARD_SCROLL_STATE_KEY);
    if (!savedState) {
      return;
    }

    window.sessionStorage.removeItem(DASHBOARD_SCROLL_STATE_KEY);
    try {
      const parsed = JSON.parse(savedState) as Partial<DashboardScrollState>;
      if (
        typeof parsed.scrollY === "number" &&
        Number.isFinite(parsed.scrollY) &&
        typeof parsed.loadedTransactions === "number" &&
        Number.isFinite(parsed.loadedTransactions)
      ) {
        setPendingScrollRestore({
          scrollY: Math.max(0, parsed.scrollY),
          loadedTransactions: Math.max(FEED_PAGE_SIZE, Math.floor(parsed.loadedTransactions)),
        });
      }
    } catch {
      setPendingScrollRestore(null);
    }
  }, []);

  useEffect(() => {
    void loadDashboardData();
  }, [loadDashboardData, selectedCurrency, startDate, endDate, selectedAccountIds]);

  useEffect(() => {
    if (!pendingScrollRestore) {
      return;
    }

    if (isTransactionsLoading || isLoadingMoreTransactions) {
      return;
    }

    if (transactions.length < pendingScrollRestore.loadedTransactions && hasMoreTransactions) {
      void loadTransactionsPage(false);
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      window.scrollTo({ top: pendingScrollRestore.scrollY, behavior: "auto" });
      setPendingScrollRestore(null);
    });
    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [
    hasMoreTransactions,
    isLoadingMoreTransactions,
    isTransactionsLoading,
    loadTransactionsPage,
    pendingScrollRestore,
    transactions.length,
  ]);

  useEffect(() => {
    transactionOffsetRef.current = 0;
    void loadTransactionsPage(true);
  }, [loadTransactionsPage, startDate, endDate]);

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

  const openTransactionPage = useCallback(
    (transactionId: number) => {
      const state: DashboardScrollState = {
        scrollY: window.scrollY,
        loadedTransactions: Math.max(transactionOffsetRef.current, transactions.length),
      };
      window.sessionStorage.setItem(DASHBOARD_SCROLL_STATE_KEY, JSON.stringify(state));
      router.push(`/transaction/${transactionId}`);
    },
    [router, transactions.length],
  );

  return (
    <section className="space-y-3 pb-1">
      <section className="app-panel grid grid-cols-1 gap-3 p-3">
        <UiBalanceSummaryCard
          totalBalance={
            totalBalance
              ? formatAmount(totalBalance.total_balance, totalBalance.currency_code)
              : "0.00"
          }
          income={summary ? formatAmount(summary.total_income, selectedCurrency) : "0.00"}
          expenses={summary ? formatAmount(summary.total_expense, selectedCurrency) : "0.00"}
        />

        {currencyOptions.length > 0 ? (
          <UiSegmentedControl
            className="mx-auto max-w-[320px]"
            options={currencyOptions}
            value={selectedCurrency}
            onChange={setSelectedCurrency}
          />
        ) : null}
      </section>

      {errorMessage ? <ErrorState message={errorMessage} /> : null}
      {isLoading ? <LoadingState message="Загружаем дашборд…" /> : null}

      {!isLoading ? (
        <section className="space-y-3">
          <section className="grid grid-cols-5 gap-2">
            <UiActionTile
              label="Доход"
              icon={Plus}
              iconClassName="bg-success-500/15 text-success-600"
              href="/transactions?create=1&type=income"
            />
            <UiActionTile
              label="Расход"
              icon={Send}
              iconClassName="bg-danger-500/15 text-danger-600"
              href="/transactions?create=1&type=expense"
            />
            <UiActionTile
              label="Перевод"
              icon={ArrowRightLeft}
              iconClassName="bg-primary-500/15 text-primary-600"
              href="/transactions?create=1&type=transfer"
            />
            <UiActionTile
              label="Списки"
              icon={WalletCards}
              iconClassName="bg-warning-500/15 text-warning-600"
              href="/shopping-lists"
            />
            <UiActionTile
              label="Регулярн."
              icon={Repeat}
              iconClassName="bg-secondary-500/15 text-secondary-600"
              href="/recurring"
            />
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-lg font-bold text-[var(--text-primary)]">Счета</h2>
              {accountBalances.length > 2 ? (
                <UiInlineAction onPress={() => setShowAllSources((prev) => !prev)}>
                  {showAllSources ? "Свернуть" : "Показать все"}
                </UiInlineAction>
              ) : null}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(showAllSources ? accountBalances : accountBalances.slice(0, 2)).map((account) => {
                const accountDetails = accountById.get(account.account_id);
                if (!accountDetails) {
                  return null;
                }

                return (
                  <UiAccountSelectTile
                    key={account.account_id}
                    account={accountDetails}
                    balanceLabel={formatAmount(account.balance, account.currency_code)}
                    selected={selectedAccountIds.includes(account.account_id)}
                    onPress={() => toggleAccountSelection(account.account_id)}
                  />
                );
              })}
            </div>
            {selectedAccountIds.length > 0 ? (
              <div className="mt-2 flex items-center justify-between rounded-2xl bg-gradient-to-r from-content2/75 to-content1 px-3 py-2 text-xs text-[var(--text-secondary)] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_8px_16px_rgba(2,6,23,0.16)]">
                <span>Фильтр по счетам: {selectedAccountIds.length}</span>
                <UiInlineAction
                  onPress={() => {
                    setSelectedAccountIds([]);
                  }}
                >
                  Сброс
                </UiInlineAction>
              </div>
            ) : null}
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="text-lg font-bold text-[var(--text-primary)]">Последние транзакции</h2>
              <div className="w-[320px]">
                <UiDateRangeField
                  label="Период"
                  classNames={tileFieldClassNames}
                  value={{ startDate, endDate }}
                  onChange={(value) => {
                    setStartDate(value.startDate || defaultRange.start);
                    setEndDate(value.endDate || defaultRange.end);
                  }}
                />
              </div>
            </div>

            <div className="motion-stagger space-y-2">
              {isTransactionsLoading ? <LoadingState message="Загружаем операции…" /> : null}

              {!isTransactionsLoading && filteredTransactions.length === 0 ? (
                <p className="rounded-2xl bg-gradient-to-b from-content2/78 to-content1 px-3 py-3 text-sm text-[var(--text-secondary)] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_8px_16px_rgba(2,6,23,0.16)]">
                  {selectedAccountIds.length > 0
                    ? "Нет операций по выбранным счетам."
                    : "Пока нет транзакций."}
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
                        <UiChip tone={account?.color}>{fromBadge}</UiChip>
                      ) : null}
                      <span className="text-[var(--text-secondary)]">→</span>
                      {toBadge ? (
                        <UiChip tone={targetAccount?.color}>{toBadge}</UiChip>
                      ) : null}
                    </>
                  ) : fromBadge ? (
                    <UiChip tone={account?.color}>{fromBadge}</UiChip>
                  ) : null;
                const shoppingBadge = transaction.shopping_list_id ? (
                  <UiChip>
                    <ListChecks className="h-3 w-3" aria-hidden="true" />
                    Список
                  </UiChip>
                ) : null;
                const recurringBadge = transaction.recurring_transaction_id ? (
                  <UiChip>
                    <Repeat className="h-3 w-3" aria-hidden="true" />
                    Регулярный
                  </UiChip>
                ) : null;
                const metaBadges =
                  shoppingBadge || recurringBadge ? (
                    <div className="flex items-center gap-1">
                      {shoppingBadge}
                      {recurringBadge}
                    </div>
                  ) : null;

                return (
                  <UiTransactionTile
                    key={transaction.id}
                    name={category?.name ?? account?.name ?? "Операция"}
                    subtitle={subtitle}
                    amount={formatAmount(transaction.amount, accountCurrency)}
                    dateLabel={formatDateLabel(transaction.transaction_date)}
                    type={transaction.type}
                    categoryIcon={category?.icon ?? null}
                    categoryColor={category?.color ?? null}
                    metaBadge={metaBadges}
                    onPress={() => openTransactionPage(transaction.id)}
                  />
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

    </section>
  );
}
