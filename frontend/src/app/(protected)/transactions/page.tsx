"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Button,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Spinner,
  useDisclosure,
} from "@heroui/react";
import {
  ArrowRight,
  ArrowRightLeft,
  Funnel,
  FunnelX,
  MoreHorizontal,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { ScreenHeader } from "@/components/screen-header";
import { useAuth } from "@/features/auth/auth-context";
import { ApiError } from "@/lib/api-client";
import { getIconOption } from "@/lib/icon-catalog";
import type {
  AccountResponse,
  CurrencyResponse,
  CategoryResponse,
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

function toSoftBackground(hexColor: string, alpha: number): string {
  const hex = hexColor.replace("#", "");
  const normalized = hex.length === 3 ? hex.split("").map((char) => `${char}${char}`).join("") : hex;

  if (normalized.length !== 6) {
    return "rgba(148, 163, 184, 0.1)";
  }

  const value = Number.parseInt(normalized, 16);
  if (Number.isNaN(value)) {
    return "rgba(148, 163, 184, 0.1)";
  }

  const red = (value >> 16) & 255;
  const green = (value >> 8) & 255;
  const blue = value & 255;
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function formatAmount(value: string): string {
  const numeric = Number(value);
  if (Number.isNaN(numeric)) {
    return value;
  }

  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(numeric);
}

function formatTransactionDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Дата не определена";
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function toLocalDateTimeValue(isoValue: string): string {
  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) {
    return getNowLocalDateTimeValue();
  }

  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function toApiDateTime(dateValue: string, timeValue: string): string {
  return new Date(`${dateValue}T${timeValue}`).toISOString();
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

function transactionTypeMeta(type: TransactionType): {
  label: string;
  chipClassName: string;
  cardClassName: string;
  Icon: typeof TrendingDown;
} {
  if (type === "income") {
    return {
      label: "Доход",
      chipClassName: "border-emerald-300 bg-emerald-100 text-emerald-800",
      cardClassName: "border-emerald-300 bg-emerald-50/70",
      Icon: TrendingUp,
    };
  }

  if (type === "transfer") {
    return {
      label: "Перевод",
      chipClassName: "border-blue-300 bg-blue-100 text-blue-800",
      cardClassName: "border-blue-300 bg-blue-50/70",
      Icon: ArrowRightLeft,
    };
  }

  return {
    label: "Расход",
    chipClassName: "border-rose-300 bg-rose-100 text-rose-800",
    cardClassName: "border-rose-300 bg-rose-50/70",
    Icon: TrendingDown,
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
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [editingTransactionId, setEditingTransactionId] = useState<number | null>(null);
  const [form, setForm] = useState<TransactionFormState>(DEFAULT_FORM);
  const { isOpen, onOpen, onOpenChange, onClose } = useDisclosure();

  const accountById = useMemo(
    () => new Map(accounts.map((account) => [account.id, account])),
    [accounts],
  );

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

  const resetForm = useCallback(() => {
    setEditingTransactionId(null);
    setForm({
      ...DEFAULT_FORM,
      accountId: accounts[0] ? String(accounts[0].id) : "",
    });
  }, [accounts]);

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
      setIsLoading(true);
      setErrorMessage(null);

      try {
        await loadReferenceData();
      } catch (error) {
        setErrorMessage(getErrorMessage(error));
      } finally {
        setIsLoading(false);
      }
    };

    void bootstrap();
  }, [loadReferenceData]);

  useEffect(() => {
    if (accounts.length === 0) {
      return;
    }

    if (!form.accountId) {
      setForm((prev) => ({
        ...prev,
        accountId: String(accounts[0].id),
      }));
    }
  }, [accounts, form.accountId]);

  useEffect(() => {
    if (accounts.length === 0) {
      return;
    }

    void loadTransactions();
  }, [accounts.length, loadTransactions]);

  useEffect(() => {
    setPage(1);
  }, [filters]);

  const openCreateModal = useCallback(() => {
    resetForm();
    onOpen();
  }, [onOpen, resetForm]);

  useEffect(() => {
    const shouldOpenCreate = searchParams.get("create") === "1";
    if (!shouldOpenCreate || isOpen || accounts.length === 0) {
      return;
    }

    openCreateModal();
    router.replace("/transactions", { scroll: false });
  }, [accounts.length, isOpen, openCreateModal, router, searchParams]);

  const openEditModal = (transaction: TransactionResponse) => {
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
    onOpen();
  };

  const openCloneModal = (transaction: TransactionResponse) => {
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
    onOpen();
  };

  const closeModal = () => {
    onClose();
    resetForm();
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

      closeModal();
      await loadTransactions();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
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

  const hasActiveFilters =
    filters.type !== "all" ||
    filters.accountId !== "all" ||
    Boolean(filters.startDate) ||
    Boolean(filters.endDate);

  const selectedAccount = form.accountId ? accountById.get(Number(form.accountId)) : null;
  const selectedCurrency = selectedAccount ? currencyById.get(selectedAccount.currency_id) : null;

  return (
    <>
      <ScreenHeader
        title="Операции"
        description="Новые сверху, быстрый ввод и понятное разделение доходов, расходов и переводов."
      />

      <section className="mb-4 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between gap-2">
          <Button color="primary" onPress={openCreateModal}>
            Добавить операцию
          </Button>
          <Button
            variant="flat"
            startContent={filtersVisible ? <FunnelX className="h-4 w-4" /> : <Funnel className="h-4 w-4" />}
            onPress={() => setFiltersVisible((prev) => !prev)}
          >
            {filtersVisible ? "Скрыть фильтры" : "Фильтры"}
          </Button>
        </div>

        {filtersVisible ? (
          <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block text-sm text-slate-700">
              Тип
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
                <option value="all">Все</option>
                <option value="expense">Расход</option>
                <option value="income">Доход</option>
                <option value="transfer">Перевод</option>
              </select>
            </label>

            <label className="block text-sm text-slate-700">
              Счет
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
                <option value="all">Все счета</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm text-slate-700">
              Дата от
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

            <label className="block text-sm text-slate-700">
              Дата до
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

            {hasActiveFilters ? (
              <div className="lg:col-span-4">
                <Button
                  size="sm"
                  variant="light"
                  onPress={() => setFilters(DEFAULT_FILTERS)}
                >
                  Сбросить фильтры
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      {errorMessage ? (
        <div className="mb-3 rounded-xl border border-danger-200 bg-danger-50 p-3 text-sm text-danger">
          {errorMessage}
        </div>
      ) : null}

      <section className="space-y-3">
        {isLoading ? (
          <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-4">
            <Spinner size="sm" />
            <p className="text-sm text-slate-700">Загружаем операции...</p>
          </div>
        ) : null}

        {!isLoading && transactions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-600">
            Операции не найдены.
          </div>
        ) : null}

        {!isLoading
          ? transactions.map((transaction) => {
              const account = accountById.get(transaction.account_id);
              const category = transaction.category_id ? categoryById.get(transaction.category_id) : null;
              const targetAccount = transaction.target_account_id
                ? accountById.get(transaction.target_account_id)
                : null;
              const typeMeta = transactionTypeMeta(transaction.type);
              const TypeIcon = typeMeta.Icon;
              const AccountIcon = account ? getIconOption(account.icon).icon : null;
              const TargetIcon = targetAccount ? getIconOption(targetAccount.icon).icon : null;
              const CategoryIcon = category ? getIconOption(category.icon).icon : null;
              const amountSign =
                transaction.type === "income" ? "+" : transaction.type === "expense" ? "-" : "";
              const amountColorClass =
                transaction.type === "income"
                  ? "text-emerald-700"
                  : transaction.type === "expense"
                    ? "text-rose-700"
                    : "text-slate-900";

              return (
                <article key={transaction.id} className={`rounded-2xl border p-3 ${typeMeta.cardClassName}`}>
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${typeMeta.chipClassName}`}
                        >
                          <TypeIcon className="h-3.5 w-3.5" />
                          {typeMeta.label}
                        </span>
                        <span className="text-xs text-slate-600">{formatTransactionDate(transaction.transaction_date)}</span>
                      </div>
                    </div>
                    <div className="flex items-start gap-1">
                      {category ? (
                        <div className="flex min-w-0 items-center gap-2">
                          <span
                            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-black/10"
                            style={{
                              backgroundColor: toSoftBackground(category.color, 0.18),
                              color: category.color,
                            }}
                          >
                            {CategoryIcon ? <CategoryIcon className="h-4 w-4" /> : null}
                          </span>
                          <span className="max-w-28 truncate text-sm font-medium text-slate-800">
                            {category.name}
                          </span>
                        </div>
                      ) : null}
                      <Dropdown>
                        <DropdownTrigger>
                          <Button isIconOnly size="sm" variant="light" aria-label="Действия">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownTrigger>
                        <DropdownMenu
                          aria-label="Действия с транзакцией"
                          onAction={(key) => {
                            if (key === "edit") {
                              openEditModal(transaction);
                              return;
                            }

                            if (key === "repeat") {
                              openCloneModal(transaction);
                              return;
                            }

                            if (key === "delete") {
                              void handleDelete(transaction.id);
                            }
                          }}
                        >
                          <DropdownItem key="meta" className="text-xs text-slate-500">
                            ID: #{transaction.id}
                          </DropdownItem>
                          <DropdownItem key="edit">Изменить</DropdownItem>
                          <DropdownItem key="repeat">Повторить</DropdownItem>
                          <DropdownItem key="delete" className="text-danger" color="danger">
                            Удалить
                          </DropdownItem>
                        </DropdownMenu>
                      </Dropdown>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 text-sm text-slate-800">
                    {transaction.type === "transfer" && targetAccount ? (
                      <div className="flex min-w-0 items-center gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          {account && AccountIcon ? (
                            <span
                              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-black/10"
                              style={{
                                backgroundColor: toSoftBackground(account.color, 0.18),
                                color: account.color,
                              }}
                            >
                              <AccountIcon className="h-4 w-4" />
                            </span>
                          ) : null}
                          <span className="max-w-24 truncate font-medium">{account?.name ?? "Счет"}</span>
                          {account?.short_identifier ? (
                            <span
                              className="shrink-0 rounded-md px-2 py-0.5 text-xs font-medium"
                              style={{
                                backgroundColor: toSoftBackground(account.color, 0.2),
                                color: account.color,
                              }}
                            >
                              •••• {account.short_identifier}
                            </span>
                          ) : null}
                        </div>
                        <ArrowRight className="h-4 w-4 shrink-0 text-slate-500" />
                        <div className="flex min-w-0 items-center gap-2">
                          {TargetIcon ? (
                            <span
                              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-black/10"
                              style={{
                                backgroundColor: toSoftBackground(targetAccount.color, 0.18),
                                color: targetAccount.color,
                              }}
                            >
                              <TargetIcon className="h-4 w-4" />
                            </span>
                          ) : null}
                          <span className="max-w-24 truncate font-medium">{targetAccount.name}</span>
                          {targetAccount.short_identifier ? (
                            <span
                              className="shrink-0 rounded-md px-2 py-0.5 text-xs font-medium"
                              style={{
                                backgroundColor: toSoftBackground(targetAccount.color, 0.2),
                                color: targetAccount.color,
                              }}
                            >
                              •••• {targetAccount.short_identifier}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    ) : (
                      <div className="flex min-w-0 items-center gap-2">
                        {account && AccountIcon ? (
                          <span
                            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-black/10"
                            style={{ backgroundColor: toSoftBackground(account.color, 0.18), color: account.color }}
                          >
                            <AccountIcon className="h-4 w-4" />
                          </span>
                        ) : null}
                        <span className="truncate font-medium">{account?.name ?? "Счет не найден"}</span>
                        {account?.short_identifier ? (
                          <span
                            className="shrink-0 rounded-md px-2 py-0.5 text-xs font-medium"
                            style={{ backgroundColor: toSoftBackground(account.color, 0.2), color: account.color }}
                          >
                            •••• {account.short_identifier}
                          </span>
                        ) : null}
                      </div>
                    )}
                    <p className={`text-right text-lg font-semibold leading-none ${amountColorClass}`}>
                      {amountSign}
                      {formatAmount(transaction.amount)}
                      <span className="ml-1 text-xs font-medium text-slate-600">
                        {account ? currencyById.get(account.currency_id)?.code ?? "" : ""}
                      </span>
                    </p>
                  </div>

                  {targetAccount && transaction.type !== "transfer" ? (
                    <div className="mt-1.5 flex min-w-0 items-center gap-2 text-sm text-slate-800">
                      {TargetIcon ? (
                        <span
                          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-black/10"
                          style={{
                            backgroundColor: toSoftBackground(targetAccount.color, 0.18),
                            color: targetAccount.color,
                          }}
                        >
                          <TargetIcon className="h-4 w-4" />
                        </span>
                      ) : null}
                      <span className="truncate font-medium">В {targetAccount.name}</span>
                      {targetAccount.short_identifier ? (
                        <span
                          className="shrink-0 rounded-md px-2 py-0.5 text-xs font-medium"
                          style={{
                            backgroundColor: toSoftBackground(targetAccount.color, 0.2),
                            color: targetAccount.color,
                          }}
                        >
                          •••• {targetAccount.short_identifier}
                        </span>
                      ) : null}
                    </div>
                  ) : null}

                  {transaction.description ? (
                    <p className="mt-1.5 line-clamp-1 text-sm text-slate-700">{transaction.description}</p>
                  ) : null}
                </article>
              );
            })
          : null}
      </section>

      <section className="mt-4 flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-3">
        <Button size="sm" variant="flat" isDisabled={page <= 1 || isLoading} onPress={() => setPage(page - 1)}>
          Назад
        </Button>
        <p className="text-sm text-slate-700">
          Страница {Math.min(page, totalPages)} / {totalPages}
        </p>
        <Button
          size="sm"
          variant="flat"
          isDisabled={isLoading || page >= totalPages}
          onPress={() => setPage(page + 1)}
        >
          Далее
        </Button>
      </section>

      <Modal
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        scrollBehavior="inside"
        backdrop="blur"
        placement="center"
      >
        <ModalContent>
          <form onSubmit={handleSubmit}>
            <ModalHeader>
              {editingTransactionId ? "Изменить операцию" : "Новая операция"}
            </ModalHeader>
            <ModalBody className="space-y-2">
              <label className="block text-sm text-slate-700">
                Тип *
                <select
                  className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                  value={form.type}
                  onChange={(event) => {
                    const nextType = event.target.value as TransactionType;
                    setForm((prev) => ({
                      ...prev,
                      type: nextType,
                      categoryId: nextType === "transfer" ? "" : prev.categoryId,
                      targetAccountId: nextType === "transfer" ? prev.targetAccountId : "",
                    }));
                  }}
                >
                  <option value="expense">Расход</option>
                  <option value="income">Доход</option>
                  <option value="transfer">Перевод</option>
                </select>
              </label>

              <label className="block text-sm text-slate-700">
                Счет *
                <select
                  className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                  value={form.accountId}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      accountId: event.target.value,
                    }))
                  }
                  required
                >
                  <option value="">Выберите счет</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
                {selectedCurrency ? (
                  <span className="mt-1 block text-xs text-slate-500">
                    Валюта счета: {selectedCurrency.code} ({selectedCurrency.symbol})
                  </span>
                ) : null}
              </label>

              {form.type === "transfer" ? (
                <label className="block text-sm text-slate-700">
                  Целевой счет *
                  <select
                    className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                    value={form.targetAccountId}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        targetAccountId: event.target.value,
                      }))
                    }
                    required
                  >
                    <option value="">Выберите счет</option>
                    {accounts
                      .filter((account) => String(account.id) !== form.accountId)
                      .map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.name}
                        </option>
                      ))}
                  </select>
                </label>
              ) : (
                <label className="block text-sm text-slate-700">
                  Категория
                  <select
                    className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                    value={form.categoryId}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        categoryId: event.target.value,
                      }))
                    }
                  >
                    <option value="">Без категории</option>
                    {formCategories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <Input
                label={`Сумма${selectedCurrency ? ` (${selectedCurrency.code})` : ""} *`}
                type="number"
                step="0.01"
                min="0.01"
                value={form.amount}
                onValueChange={(value) => setForm((prev) => ({ ...prev, amount: value }))}
                required
              />

              <Input
                label="Дата и время"
                type="datetime-local"
                value={form.transactionDate}
                onValueChange={(value) =>
                  setForm((prev) => ({
                    ...prev,
                    transactionDate: value,
                  }))
                }
              />

              <Input
                label="Комментарий"
                value={form.description}
                onValueChange={(value) => setForm((prev) => ({ ...prev, description: value }))}
              />
            </ModalBody>
            <ModalFooter>
              <Button variant="flat" type="button" onPress={closeModal}>
                Отмена
              </Button>
              <Button color="primary" type="submit" isLoading={isSubmitting}>
                {editingTransactionId ? "Сохранить" : "Создать"}
              </Button>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>
    </>
  );
}
