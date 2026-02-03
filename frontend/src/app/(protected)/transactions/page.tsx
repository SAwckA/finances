"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRightLeft,
  Check,
  ChevronRight,
  Copy,
  Pencil,
  Trash2,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { EmptyState, ErrorState, LoadingState } from "@/components/async-state";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useAuth } from "@/features/auth/auth-context";
import { ApiError } from "@/lib/api-client";
import { getIconOption } from "@/lib/icon-catalog";
import type {
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
  const [transactions, setTransactions] = useState<TransactionResponse[]>([]);
  const [accounts, setAccounts] = useState<AccountResponse[]>([]);
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

  const accountById = useMemo(() => new Map(accounts.map((account) => [account.id, account])), [accounts]);
  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  );
  const currencyById = useMemo(
    () => new Map(currencies.map((currency) => [currency.id, currency])),
    [currencies],
  );

  const formCategories = useMemo(() => {
    if (form.type === "transfer") {
      return [];
    }

    return categories.filter((category) => category.type === form.type);
  }, [categories, form.type]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const selectedAccount = form.accountId ? accountById.get(Number(form.accountId)) : null;
  const selectedCurrency = selectedAccount ? currencyById.get(selectedAccount.currency_id) : null;

  const loadReferenceData = useCallback(async () => {
    const [accountsData, categoriesData, currenciesData] = await Promise.all([
      authenticatedRequest<AccountResponse[]>("/api/accounts?skip=0&limit=300"),
      authenticatedRequest<CategoryResponse[]>("/api/categories?skip=0&limit=300"),
      authenticatedRequest<CurrencyResponse[]>("/api/currencies?skip=0&limit=300"),
    ]);

    setAccounts(accountsData);
    setCategories(categoriesData);
    setCurrencies(currenciesData);
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
    if (searchParams.get("create") !== "1") {
      return;
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
    router.replace("/transactions", { scroll: false });
  }, [router, searchParams]);

  const resetForm = useCallback(() => {
    setEditingTransactionId(null);
    setForm({
      ...DEFAULT_FORM,
      accountId: accounts[0] ? String(accounts[0].id) : "",
    });
  }, [accounts]);

  const handleEdit = (transaction: TransactionResponse) => {
    setEditingTransactionId(transaction.id);
    setForm({
      type: transaction.type,
      accountId: String(transaction.account_id),
      targetAccountId: transaction.target_account_id ? String(transaction.target_account_id) : "",
      categoryId: transaction.category_id ? String(transaction.category_id) : "",
      amount: transaction.amount,
      description: transaction.description ?? "",
      transactionDate: toLocalDateTimeValue(transaction.transaction_date),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleClone = (transaction: TransactionResponse) => {
    setEditingTransactionId(null);
    setForm({
      type: transaction.type,
      accountId: String(transaction.account_id),
      targetAccountId: transaction.target_account_id ? String(transaction.target_account_id) : "",
      categoryId: transaction.category_id ? String(transaction.category_id) : "",
      amount: transaction.amount,
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
        const updatePayload: TransactionUpdate = {
          amount: Number(form.amount),
          description: form.description.trim() || null,
          transaction_date: new Date(form.transactionDate).toISOString(),
          category_id: form.type === "transfer" ? null : form.categoryId ? Number(form.categoryId) : null,
        };

        await authenticatedRequest(`/api/transactions/${editingTransactionId}`, {
          method: "PATCH",
          body: updatePayload,
        });
      } else {
        const createPayload: TransactionCreate = {
          type: form.type,
          account_id: Number(form.accountId),
          amount: Number(form.amount),
          description: form.description.trim() || null,
          transaction_date: new Date(form.transactionDate).toISOString(),
          target_account_id: form.type === "transfer" ? Number(form.targetAccountId) : null,
          category_id: form.type === "transfer" ? null : form.categoryId ? Number(form.categoryId) : null,
        };

        await authenticatedRequest("/api/transactions", {
          method: "POST",
          body: createPayload,
        });
      }

      resetForm();
      await loadTransactions();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="space-y-3">
      <form className="mobile-card space-y-3 p-3" onSubmit={handleSubmit}>
        <div className="flex items-center justify-between">
          <h1 className="section-title text-[1.35rem]">
            {editingTransactionId ? "Edit Transaction" : "Add Transaction"}
          </h1>
          {editingTransactionId ? (
            <button
              type="button"
              className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-700"
              onClick={resetForm}
            >
              Cancel edit
            </button>
          ) : null}
        </div>

        <SegmentedControl
          options={[
            { key: "expense", label: "Expense" },
            { key: "income", label: "Income" },
            { key: "transfer", label: "Transfer" },
          ]}
          value={form.type}
          onChange={(nextType) =>
            setForm((prev) => ({
              ...prev,
              type: nextType,
              categoryId: nextType === "transfer" ? "" : prev.categoryId,
              targetAccountId: nextType === "transfer" ? prev.targetAccountId : "",
            }))
          }
        />

        <div className="text-center">
          <p className="text-sm font-medium text-slate-500">Amount</p>
          <label className="mt-1 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <span className="text-2xl font-semibold text-slate-400">$</span>
            <input
              className="w-36 border-none bg-transparent text-4xl font-bold tracking-tight text-slate-500 outline-none"
              type="number"
              step="0.01"
              min="0.01"
              value={form.amount}
              onChange={(event) => setForm((prev) => ({ ...prev, amount: event.target.value }))}
              placeholder="0.00"
              required
            />
          </label>
        </div>

        <section>
          <p className="mb-1.5 text-base font-semibold text-slate-700">Payment Source</p>
          <div className="space-y-2">
            {accounts.map((account) => {
              const selected = String(account.id) === form.accountId;
              const Icon = getIconOption(account.icon).icon;
              return (
                <button
                  key={account.id}
                  type="button"
                  className={`flex w-full items-center justify-between rounded-2xl border px-3 py-2.5 text-left ${
                    selected
                      ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/5"
                      : "border-slate-200 bg-white"
                  }`}
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      accountId: String(account.id),
                    }))
                  }
                >
                  <div className="flex items-center gap-2.5">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                      <Icon className="h-4.5 w-4.5" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{account.name}</p>
                      <p className="text-xs text-slate-500">
                        {account.short_identifier ? `***${account.short_identifier}` : "No short id"}
                      </p>
                    </div>
                  </div>
                  {selected ? <Check className="h-4.5 w-4.5 text-[var(--accent-primary)]" /> : null}
                </button>
              );
            })}
          </div>
        </section>

        {form.type === "transfer" ? (
          <section>
            <p className="mb-1.5 text-base font-semibold text-slate-700">Target Source</p>
            <div className="space-y-2">
              {accounts
                .filter((account) => String(account.id) !== form.accountId)
                .map((account) => {
                  const selected = String(account.id) === form.targetAccountId;
                  const Icon = getIconOption(account.icon).icon;
                  return (
                    <button
                      key={account.id}
                      type="button"
                      className={`flex w-full items-center justify-between rounded-2xl border px-3 py-2.5 text-left ${
                        selected
                          ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/5"
                          : "border-slate-200 bg-white"
                      }`}
                      onClick={() =>
                        setForm((prev) => ({
                          ...prev,
                          targetAccountId: String(account.id),
                        }))
                      }
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                          <Icon className="h-4.5 w-4.5" />
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-slate-800">{account.name}</p>
                          <p className="text-xs text-slate-500">
                            {account.short_identifier ? `***${account.short_identifier}` : "No short id"}
                          </p>
                        </div>
                      </div>
                      {selected ? <Check className="h-4.5 w-4.5 text-[var(--accent-primary)]" /> : null}
                    </button>
                  );
                })}
            </div>
          </section>
        ) : (
          <section>
            <p className="mb-1.5 text-base font-semibold text-slate-700">Category</p>
            <div className="grid grid-cols-3 gap-2">
              {formCategories.map((category) => {
                const selected = String(category.id) === form.categoryId;
                const Icon = getIconOption(category.icon).icon;
                return (
                  <button
                    key={category.id}
                    type="button"
                    className={`rounded-2xl border px-2 py-2.5 text-center ${
                      selected
                        ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/5"
                        : "border-slate-200 bg-white"
                    }`}
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        categoryId: String(category.id),
                      }))
                    }
                  >
                    <span
                      className="mx-auto inline-flex h-8 w-8 items-center justify-center rounded-xl"
                      style={{ backgroundColor: `${category.color}22`, color: category.color }}
                    >
                      <Icon className="h-4.5 w-4.5" />
                    </span>
                    <p className="mt-1 text-xs font-semibold text-slate-700">{category.name}</p>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        <label className="block text-sm text-slate-700">
          Description (Optional)
          <input
            className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            value={form.description}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                description: event.target.value,
              }))
            }
          />
        </label>

        <label className="block text-sm text-slate-700">
          Date and time
          <input
            className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            type="datetime-local"
            value={form.transactionDate}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                transactionDate: event.target.value,
              }))
            }
          />
        </label>

        <button
          type="submit"
          className="w-full rounded-xl bg-[var(--accent-primary)] px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--accent-primary-strong)] disabled:cursor-not-allowed disabled:opacity-70"
          disabled={isSubmitting}
        >
          {isSubmitting
            ? "Saving..."
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

      <section className="mobile-card p-3">
        <p className="mb-2 text-base font-semibold text-slate-800">Filters</p>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-sm text-slate-700">
            Type
            <select
              className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
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
          className="mt-2 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-700"
          onClick={() => setFilters(DEFAULT_FILTERS)}
        >
          Reset filters
        </button>
      </section>

      {errorMessage ? <ErrorState message={errorMessage} /> : null}

      <section className="space-y-2">
        {isLoading ? <LoadingState message="Загружаем операции..." /> : null}
        {!isLoading && transactions.length === 0 ? <EmptyState message="Операции не найдены." /> : null}

        {!isLoading
          ? transactions.map((transaction) => {
              const account = accountById.get(transaction.account_id);
              const targetAccount = transaction.target_account_id
                ? accountById.get(transaction.target_account_id)
                : null;
              const category = transaction.category_id ? categoryById.get(transaction.category_id) : null;
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
                      <p className="mt-0.5 text-xs text-slate-500">{formatDateLabel(transaction.transaction_date)}</p>
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
                    {transaction.description ? <p className="mt-1 text-xs text-slate-500">{transaction.description}</p> : null}
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
    </section>
  );
}
