"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRightLeft,
  ChevronRight,
  Copy,
  Pencil,
  Trash2,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { EmptyState, ErrorState, LoadingState } from "@/components/async-state";
import { TransactionFormFields } from "@/components/transactions/transaction-form-fields";
import { TransactionEditorHeader } from "@/components/transactions/transaction-editor-header";
import { useAuth } from "@/features/auth/auth-context";
import { ApiError } from "@/lib/api-client";
import type {
  AccountBalanceResponse,
  AccountResponse,
  CategoryResponse,
  CurrencyResponse,
  TransactionCreate,
  TransactionResponse,
  TransactionType,
  TransactionUpdate,
} from "@/lib/types";

type TransactionTypeFilter = TransactionType | "all";

type TransactionFilters = {
  type: TransactionTypeFilter;
  accountId: string;
  startDate: string;
  endDate: string;
};

type TransactionFormState = {
  type: TransactionType;
  accountId: string;
  targetAccountId: string;
  categoryId: string;
  amount: string;
  targetAmount: string;
  description: string;
  transactionDate: string;
};

const PAGE_SIZE = 20;

const DEFAULT_FILTERS: TransactionFilters = {
  type: "all",
  accountId: "all",
  startDate: "",
  endDate: "",
};

function getNowLocalDateTimeValue(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 16);
}

const DEFAULT_FORM: TransactionFormState = {
  type: "expense",
  accountId: "",
  targetAccountId: "",
  categoryId: "",
  amount: "",
  targetAmount: "",
  description: "",
  transactionDate: getNowLocalDateTimeValue(),
};

function toApiDateTime(dateValue: string, timeValue: string): string {
  return new Date(`${dateValue}T${timeValue}`).toISOString();
}

function toLocalDateTimeValue(isoValue: string): string {
  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) {
    return getNowLocalDateTimeValue();
  }

  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function formatAmount(value: string): string {
  const numeric = Number(value);
  if (Number.isNaN(numeric)) {
    return value;
  }

  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
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

function sortByNewest(items: TransactionResponse[]): TransactionResponse[] {
  return [...items].sort((first, second) => {
    return new Date(second.transaction_date).getTime() - new Date(first.transaction_date).getTime();
  });
}

function parseTransactionType(value: string | null): TransactionType | null {
  if (value === "income" || value === "expense" || value === "transfer") {
    return value;
  }
  return null;
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

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function transactionMeta(type: TransactionType): {
  amountClassName: string;
  sign: string;
  label: string;
  icon: typeof TrendingDown;
} {
  if (type === "income") {
    return {
      amountClassName: "text-emerald-700",
      sign: "+",
      label: "Income",
      icon: TrendingUp,
    };
  }

  if (type === "transfer") {
    return {
      amountClassName: "text-indigo-700",
      sign: "",
      label: "Transfer",
      icon: ArrowRightLeft,
    };
  }

  return {
    amountClassName: "text-rose-700",
    sign: "-",
    label: "Expense",
    icon: TrendingDown,
  };
}

export default function TransactionsPage() {
  const { authenticatedRequest } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const createParam = searchParams.get("create");
  const isCreateRoute = createParam === "1" || createParam === "true";
  const requestedType = parseTransactionType(searchParams.get("type"));
  const [transactions, setTransactions] = useState<TransactionResponse[]>([]);
  const [accounts, setAccounts] = useState<AccountResponse[]>([]);
  const [accountBalances, setAccountBalances] = useState<AccountBalanceResponse[]>([]);
  const [categories, setCategories] = useState<CategoryResponse[]>([]);
  const [currencies, setCurrencies] = useState<CurrencyResponse[]>([]);
  const [filters, setFilters] = useState<TransactionFilters>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [editingTransactionId, setEditingTransactionId] = useState<number | null>(null);
  const [form, setForm] = useState<TransactionFormState>(DEFAULT_FORM);
  const [createMode, setCreateMode] = useState(false);

  const accountById = useMemo(() => new Map(accounts.map((account) => [account.id, account])), [accounts]);
  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  );
  const currencyById = useMemo(
    () => new Map(currencies.map((currency) => [currency.id, currency])),
    [currencies],
  );

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const selectedAccount = form.accountId ? accountById.get(Number(form.accountId)) : null;
  const selectedCurrency = selectedAccount ? currencyById.get(selectedAccount.currency_id) : null;

  const loadReferenceData = useCallback(async () => {
    const [accountsData, categoriesData, currenciesData, balancesData] = await Promise.all([
      authenticatedRequest<AccountResponse[]>("/api/accounts?skip=0&limit=300"),
      authenticatedRequest<CategoryResponse[]>("/api/categories?skip=0&limit=300"),
      authenticatedRequest<CurrencyResponse[]>("/api/currencies?skip=0&limit=300"),
      authenticatedRequest<AccountBalanceResponse[]>("/api/statistics/balance"),
    ]);

    setAccounts(accountsData);
    setCategories(categoriesData);
    setCurrencies(currenciesData);
    setAccountBalances(balancesData);
  }, [authenticatedRequest]);

  const loadTransactions = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const hasPeriod = Boolean(filters.startDate && filters.endDate);
      const offset = (page - 1) * PAGE_SIZE;
      let sourceItems: TransactionResponse[] = [];

      if (hasPeriod) {
        const query = new URLSearchParams({
          start_date: toApiDateTime(filters.startDate, "00:00:00"),
          end_date: toApiDateTime(filters.endDate, "23:59:59"),
        });

        if (filters.type !== "all") {
          query.set("transaction_type", filters.type);
        }

        const periodItems = await authenticatedRequest<TransactionResponse[]>(
          `/api/transactions/period?${query.toString()}`,
        );

        sourceItems =
          filters.accountId === "all"
            ? periodItems
            : periodItems.filter((transaction) => transaction.account_id === Number(filters.accountId));
      } else {
        const basePath =
          filters.accountId === "all"
            ? "/api/transactions?skip=0&limit=1000"
            : `/api/transactions/account/${filters.accountId}?skip=0&limit=1000`;

        const baseItems = await authenticatedRequest<TransactionResponse[]>(basePath);
        sourceItems =
          filters.type === "all"
            ? baseItems
            : baseItems.filter((transaction) => transaction.type === filters.type);
      }

      const ordered = sortByNewest(sourceItems);
      setTotalCount(ordered.length);
      setTransactions(ordered.slice(offset, offset + PAGE_SIZE));
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, [authenticatedRequest, filters, page]);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        await loadReferenceData();
      } catch (error) {
        setErrorMessage(getErrorMessage(error));
      }
    };
    void bootstrap();
  }, [loadReferenceData]);

  useEffect(() => {
    if (accounts.length === 0 || form.accountId) {
      return;
    }

    setForm((prev) => ({ ...prev, accountId: String(accounts[0].id) }));
  }, [accounts, form.accountId]);

  useEffect(() => {
    void loadTransactions();
  }, [loadTransactions]);

  useEffect(() => {
    setPage(1);
  }, [filters]);

  useEffect(() => {
    if (isCreateRoute) {
      setCreateMode(true);
      setEditingTransactionId(null);
      setForm((prev) => ({
        ...DEFAULT_FORM,
        accountId: prev.accountId || (accounts[0] ? String(accounts[0].id) : ""),
        type: requestedType ?? prev.type,
        targetAccountId: requestedType === "transfer" ? prev.targetAccountId : "",
        categoryId: requestedType === "transfer" ? "" : prev.categoryId,
        targetAmount: requestedType === "transfer" ? prev.targetAmount : "",
      }));
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setCreateMode(false);
  }, [accounts, isCreateRoute, requestedType]);

  const resetForm = useCallback(() => {
    setEditingTransactionId(null);
    setForm({
      ...DEFAULT_FORM,
      accountId: accounts[0] ? String(accounts[0].id) : "",
    });
    setCreateMode(false);
  }, [accounts]);

  const handleEdit = (transaction: TransactionResponse) => {
    setEditingTransactionId(transaction.id);
    setCreateMode(false);
    setForm({
      type: transaction.type,
      accountId: String(transaction.account_id),
      targetAccountId: transaction.target_account_id ? String(transaction.target_account_id) : "",
      categoryId: transaction.category_id ? String(transaction.category_id) : "",
      amount: transaction.amount,
      targetAmount: transaction.type === "transfer" ? transaction.converted_amount ?? "" : "",
      description: transaction.description ?? "",
      transactionDate: toLocalDateTimeValue(transaction.transaction_date),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleClone = (transaction: TransactionResponse) => {
    setEditingTransactionId(null);
    setCreateMode(true);
    setForm({
      type: transaction.type,
      accountId: String(transaction.account_id),
      targetAccountId: transaction.target_account_id ? String(transaction.target_account_id) : "",
      categoryId: transaction.category_id ? String(transaction.category_id) : "",
      amount: transaction.amount,
      targetAmount: transaction.type === "transfer" ? transaction.converted_amount ?? "" : "",
      description: transaction.description ?? "",
      transactionDate: getNowLocalDateTimeValue(),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (transactionId: number) => {
    const confirmed = window.confirm("Удалить транзакцию?");
    if (!confirmed) {
      return;
    }

    setErrorMessage(null);
    try {
      await authenticatedRequest(`/api/transactions/${transactionId}`, { method: "DELETE" });
      await loadTransactions();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!form.accountId || !form.amount) {
      setErrorMessage("Заполните обязательные поля: счет и сумма.");
      return;
    }

    if (form.type === "transfer" && !form.targetAccountId) {
      setErrorMessage("Для перевода нужно выбрать целевой счет.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      if (editingTransactionId) {
        const query = new URLSearchParams();
        if (form.type === "transfer" && form.targetAmount) {
          const sourceAmount = Number(form.amount);
          const targetAmount = Number(form.targetAmount);
          if (Number.isFinite(sourceAmount) && sourceAmount > 0 && Number.isFinite(targetAmount)) {
            query.set("converted_amount", targetAmount.toString());
            query.set("exchange_rate", (targetAmount / sourceAmount).toString());
          }
        }
        const url = query.toString()
          ? `/api/transactions/${editingTransactionId}?${query.toString()}`
          : `/api/transactions/${editingTransactionId}`;
        const updatePayload: TransactionUpdate = {
          account_id: Number(form.accountId),
          amount: Number(form.amount),
          description: form.description.trim() || null,
          transaction_date: new Date(form.transactionDate).toISOString(),
          category_id: form.type === "transfer" ? null : form.categoryId ? Number(form.categoryId) : null,
        };

        await authenticatedRequest(url, {
          method: "PATCH",
          body: updatePayload,
        });
      } else {
        const query = new URLSearchParams();
        if (form.type === "transfer" && form.targetAmount) {
          const sourceAmount = Number(form.amount);
          const targetAmount = Number(form.targetAmount);
          if (Number.isFinite(sourceAmount) && sourceAmount > 0 && Number.isFinite(targetAmount)) {
            query.set("converted_amount", targetAmount.toString());
            query.set("exchange_rate", (targetAmount / sourceAmount).toString());
          }
        }
        const url = query.toString() ? `/api/transactions?${query.toString()}` : "/api/transactions";
        const createPayload: TransactionCreate = {
          type: form.type,
          account_id: Number(form.accountId),
          amount: Number(form.amount),
          description: form.description.trim() || null,
          transaction_date: new Date(form.transactionDate).toISOString(),
          target_account_id: form.type === "transfer" ? Number(form.targetAccountId) : null,
          category_id: form.type === "transfer" ? null : form.categoryId ? Number(form.categoryId) : null,
        };

        await authenticatedRequest(url, {
          method: "POST",
          body: createPayload,
        });
      }

      await loadTransactions();
      if (!editingTransactionId && isCreateRoute) {
        router.back();
        return;
      }
      resetForm();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="space-y-3">
      {createMode ? (
        <section className="fixed inset-0 z-50 overscroll-contain bg-[var(--bg-app)]">
          <div className="mx-auto flex h-full w-full max-w-[430px] flex-col">
            <TransactionEditorHeader
              title="Add Transaction"
              onBack={() => router.back()}
              formId="transaction-form"
              isSaving={isSubmitting}
            />
            <div className="flex-1 overflow-y-auto px-3 py-3">
              <form
                id="transaction-form"
                className="mobile-card space-y-3 p-3"
                onSubmit={handleSubmit}
              >
                <TransactionFormFields
                  form={form}
                  setForm={setForm}
                  transactionType={form.type}
                  onTypeChange={(nextType) =>
                    setForm((prev) => ({
                      ...prev,
                      type: nextType,
                      categoryId: nextType === "transfer" ? "" : prev.categoryId,
                      targetAccountId: nextType === "transfer" ? prev.targetAccountId : "",
                    }))
                  }
                  accounts={accounts}
                  accountBalances={accountBalances}
                  categories={categories}
                  currencies={currencies}
                  showTypeSelector
                />
              </form>
            </div>
          </div>
        </section>
      ) : null}

      {!createMode ? (
        <form
          id="transaction-form"
          className="mobile-card space-y-3 p-3"
          onSubmit={handleSubmit}
        >
          <div className="flex items-center justify-between">
            <h1 className="section-title text-[1.35rem]">
              {editingTransactionId ? "Edit Transaction" : "Add Transaction"}
            </h1>
            {editingTransactionId ? (
              <button
                type="button"
                className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
                onClick={resetForm}
              >
                Cancel Edit
              </button>
            ) : null}
          </div>

          <TransactionFormFields
            form={form}
            setForm={setForm}
            transactionType={form.type}
            onTypeChange={(nextType) =>
              setForm((prev) => ({
                ...prev,
                type: nextType,
                categoryId: nextType === "transfer" ? "" : prev.categoryId,
                targetAccountId: nextType === "transfer" ? prev.targetAccountId : "",
              }))
            }
            accounts={accounts}
            accountBalances={accountBalances}
            categories={categories}
            currencies={currencies}
            showTypeSelector
          />

          <button
            type="submit"
            className="w-full rounded-xl bg-[var(--accent-primary)] px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--accent-primary-strong)] disabled:cursor-not-allowed disabled:opacity-70"
            disabled={isSubmitting}
          >
            {isSubmitting
              ? "Saving…"
              : editingTransactionId
                ? "Save Transaction"
                : `Create ${form.type === "income" ? "Income" : form.type === "expense" ? "Expense" : "Transfer"}`}
          </button>

        {selectedCurrency ? (
          <p className="text-center text-xs text-slate-500">
            Account currency: {selectedCurrency.code} ({selectedCurrency.symbol})
          </p>
        ) : null}
        </form>
      ) : null}

      {!createMode ? (
        <>
          <section className="mobile-card p-3">
            <p className="mb-2 text-base font-semibold text-slate-800">Filters</p>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-sm text-slate-700">
                Type
                <select
                  className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                  name="typeFilter"
                  autoComplete="off"
                  value={filters.type}
                  onChange={(event) =>
                    setFilters((prev) => ({
                      ...prev,
                      type: event.target.value as TransactionTypeFilter,
                    }))
                  }
                >
                  <option value="all">All</option>
                  <option value="expense">Expense</option>
                  <option value="income">Income</option>
                  <option value="transfer">Transfer</option>
                </select>
              </label>
              <label className="text-sm text-slate-700">
                Source
                <select
                  className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                  name="accountFilter"
                  autoComplete="off"
                  value={filters.accountId}
                  onChange={(event) =>
                    setFilters((prev) => ({
                      ...prev,
                      accountId: event.target.value,
                    }))
                  }
                >
                  <option value="all">All accounts</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-slate-700">
                Start
                <input
                  className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                  type="date"
                  name="startDate"
                  autoComplete="off"
                  value={filters.startDate}
                  onChange={(event) =>
                    setFilters((prev) => ({
                      ...prev,
                      startDate: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="text-sm text-slate-700">
                End
                <input
                  className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                  type="date"
                  name="endDate"
                  autoComplete="off"
                  value={filters.endDate}
                  onChange={(event) =>
                    setFilters((prev) => ({
                      ...prev,
                      endDate: event.target.value,
                    }))
                  }
                />
              </label>
            </div>
            <button
              type="button"
              className="mt-2 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
              onClick={() => setFilters(DEFAULT_FILTERS)}
            >
              Reset Filters
            </button>
          </section>

          {errorMessage ? <ErrorState message={errorMessage} /> : null}

          <section className="space-y-2">
            {isLoading ? <LoadingState message="Загружаем операции…" /> : null}
            {!isLoading && transactions.length === 0 ? (
              <EmptyState message="Операции не найдены." />
            ) : null}

            {!isLoading
              ? transactions.map((transaction) => {
                  const account = accountById.get(transaction.account_id);
                  const targetAccount = transaction.target_account_id
                    ? accountById.get(transaction.target_account_id)
                    : null;
                  const category = transaction.category_id
                    ? categoryById.get(transaction.category_id)
                    : null;
                  const meta = transactionMeta(transaction.type);
                  const MetaIcon = meta.icon;

                  return (
                    <article key={transaction.id} className="mobile-card p-3">
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                              <MetaIcon className="h-3.5 w-3.5" />
                            </span>
                            <p className="truncate text-sm font-semibold text-slate-800">{meta.label}</p>
                          </div>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {formatDateLabel(transaction.transaction_date)}
                          </p>
                        </div>
                        <p className={`text-right text-lg font-bold ${meta.amountClassName}`}>
                          {meta.sign}
                          {formatAmount(transaction.amount)}
                        </p>
                      </div>

                      <div className="text-sm text-slate-700">
                        <p>
                          {account?.name ?? "Unknown account"}
                          {targetAccount ? ` -> ${targetAccount.name}` : ""}
                        </p>
                        {category ? <p className="text-xs text-slate-500">{category.name}</p> : null}
                        {transaction.description ? (
                          <p className="mt-1 text-xs text-slate-500">{transaction.description}</p>
                        ) : null}
                      </div>

                      <div className="mt-2 flex items-center gap-1.5">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700"
                          onClick={() => handleEdit(transaction)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </button>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700"
                          onClick={() => handleClone(transaction)}
                        >
                          <Copy className="h-3.5 w-3.5" />
                          Clone
                        </button>
                        <button
                          type="button"
                          className="ml-auto inline-flex items-center gap-1 rounded-lg bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700"
                          onClick={() => void handleDelete(transaction.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </button>
                      </div>
                    </article>
                  );
                })
              : null}
          </section>

          <section className="mobile-card flex items-center justify-between px-3 py-2">
            <button
              type="button"
              className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-60"
              disabled={page <= 1 || isLoading}
              onClick={() => setPage((prev) => prev - 1)}
            >
              Back
            </button>
            <p className="text-sm text-slate-700">
              Page {Math.min(page, totalPages)} / {totalPages}
            </p>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-60"
              disabled={isLoading || page >= totalPages}
              onClick={() => setPage((prev) => prev + 1)}
            >
              Next
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </section>
        </>
      ) : null}
    </section>
  );
}
