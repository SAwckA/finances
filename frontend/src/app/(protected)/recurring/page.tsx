"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button, DatePicker, Dropdown, DropdownItem, DropdownMenu, DropdownTrigger } from "@heroui/react";
import {
  ClockArrowUp,
  MoreHorizontal,
  PauseCircle,
  PlayCircle,
  Repeat,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { EmptyState, ErrorState, LoadingState } from "@/components/async-state";
import { TransactionEditorHeader } from "@/components/transactions/transaction-editor-header";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useAuth } from "@/features/auth/auth-context";
import { ApiError } from "@/lib/api-client";
import { getIconOption } from "@/lib/icon-catalog";
import { fromDateValue, toDateValue } from "@/lib/date-ui";
import type {
  AccountResponse,
  CategoryResponse,
  CurrencyResponse,
  RecurringFrequency,
  RecurringTransactionCreate,
  RecurringTransactionResponse,
  RecurringTransactionUpdate,
} from "@/lib/types";

type RecurringView = "all" | "active" | "inactive" | "pending";

type RecurringFormState = {
  type: "income" | "expense";
  name: string;
  accountId: string;
  categoryId: string;
  amount: string;
  frequency: RecurringFrequency;
  dayOfWeek: string;
  dayOfMonth: string;
  startDate: string;
  endDate: string;
};

const FORM_ID = "recurring-editor-form";

const WEEK_DAYS = [
  { value: "0", label: "Пн" },
  { value: "1", label: "Вт" },
  { value: "2", label: "Ср" },
  { value: "3", label: "Чт" },
  { value: "4", label: "Пт" },
  { value: "5", label: "Сб" },
  { value: "6", label: "Вс" },
];

const FREQUENCY_OPTIONS: Array<{ key: RecurringFrequency; label: string }> = [
  { key: "daily", label: "Ежедневно" },
  { key: "weekly", label: "Еженедельно" },
  { key: "monthly", label: "Ежемесячно" },
];

function todayDateValue(): string {
  return new Date().toISOString().slice(0, 10);
}

function currentWeekdayValue(): string {
  const jsDay = new Date().getDay();
  const mondayFirst = jsDay === 0 ? 6 : jsDay - 1;
  return String(mondayFirst);
}

function currentMonthDayValue(): string {
  return String(new Date().getDate());
}

const DEFAULT_FORM: RecurringFormState = {
  type: "expense",
  name: "",
  accountId: "",
  categoryId: "",
  amount: "",
  frequency: "monthly",
  dayOfWeek: currentWeekdayValue(),
  dayOfMonth: currentMonthDayValue(),
  startDate: todayDateValue(),
  endDate: "",
};

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

function formatAmountWithCurrency(
  value: string,
  currencyCode: string | undefined,
  currencySymbol: string | undefined,
): string {
  const numeric = Number(value);
  if (Number.isNaN(numeric)) {
    return value;
  }

  if (currencyCode) {
    try {
      return new Intl.NumberFormat("ru-RU", {
        style: "currency",
        currency: currencyCode,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(numeric);
    } catch {
      return `${formatAmount(value)} ${currencySymbol ?? currencyCode}`;
    }
  }

  return formatAmount(value);
}

function formatDate(value: string): string {
  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsedDate);
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

function frequencyLabel(frequency: RecurringFrequency): string {
  if (frequency === "daily") {
    return "Ежедневно";
  }
  if (frequency === "weekly") {
    return "Еженедельно";
  }
  return "Ежемесячно";
}

function toSoftBackground(hexColor: string, alpha: number): string {
  const hex = hexColor.replace("#", "");
  const normalized =
    hex.length === 3 ? hex.split("").map((char) => `${char}${char}`).join("") : hex;

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

export default function RecurringPage() {
  const { authenticatedRequest } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const createParam = searchParams.get("create");
  const editParam = searchParams.get("edit");
  const isCreateMode = createParam === "1" || createParam === "true";
  const parsedEditId = editParam ? Number(editParam) : null;
  const editingId = Number.isFinite(parsedEditId ?? Number.NaN) ? (parsedEditId as number) : null;
  const isEditorMode = isCreateMode || Boolean(editingId);

  const [view, setView] = useState<RecurringView>("all");
  const [recurringItems, setRecurringItems] = useState<RecurringTransactionResponse[]>([]);
  const [pendingItems, setPendingItems] = useState<RecurringTransactionResponse[]>([]);
  const [accounts, setAccounts] = useState<AccountResponse[]>([]);
  const [categories, setCategories] = useState<CategoryResponse[]>([]);
  const [currencies, setCurrencies] = useState<CurrencyResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditorLoading, setIsEditorLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [form, setForm] = useState<RecurringFormState>(DEFAULT_FORM);

  const accountById = useMemo(() => new Map(accounts.map((account) => [account.id, account])), [accounts]);
  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  );
  const currencyByCode = useMemo(
    () => new Map(currencies.map((currency) => [currency.code, currency])),
    [currencies],
  );

  const formCategories = useMemo(
    () => categories.filter((category) => category.type === form.type),
    [categories, form.type],
  );

  const selectedItems = view === "pending" ? pendingItems : recurringItems;
  const focusRecurringId = useMemo(() => {
    const raw = searchParams.get("focus");
    if (!raw) {
      return null;
    }
    const value = Number(raw);
    return Number.isInteger(value) && value > 0 ? value : null;
  }, [searchParams]);

  const buildHref = useCallback(
    (name: "create" | "edit", value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(name, value);
      } else {
        params.delete(name);
      }

      if (name === "create") {
        params.delete("edit");
      }
      if (name === "edit") {
        params.delete("create");
      }

      const query = params.toString();
      return query ? `${pathname}?${query}` : pathname;
    },
    [pathname, searchParams],
  );

  const resetForm = useCallback(() => {
    setForm({
      ...DEFAULT_FORM,
      accountId: accounts[0] ? String(accounts[0].id) : "",
      categoryId: "",
      startDate: todayDateValue(),
      dayOfWeek: currentWeekdayValue(),
      dayOfMonth: currentMonthDayValue(),
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

  const loadRecurring = useCallback(
    async (nextView: RecurringView) => {
      const query = new URLSearchParams({
        skip: "0",
        limit: "300",
      });

      if (nextView === "active") {
        query.set("is_active", "true");
      } else if (nextView === "inactive") {
        query.set("is_active", "false");
      }

      const response = await authenticatedRequest<RecurringTransactionResponse[]>(
        `/api/recurring-transactions?${query.toString()}`,
      );
      setRecurringItems(response);
    },
    [authenticatedRequest],
  );

  const loadPending = useCallback(async () => {
    const response = await authenticatedRequest<RecurringTransactionResponse[]>(
      "/api/recurring-transactions/pending",
    );
    setPendingItems(response);
  }, [authenticatedRequest]);

  const refreshData = useCallback(
    async (nextView: RecurringView) => {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        await Promise.all([loadRecurring(nextView), loadPending()]);
      } catch (error) {
        setErrorMessage(getErrorMessage(error));
      } finally {
        setIsLoading(false);
      }
    },
    [loadPending, loadRecurring],
  );

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
    void refreshData(view);
  }, [refreshData, view]);

  useEffect(() => {
    if (accounts.length === 0 || form.accountId) {
      return;
    }

    setForm((prev) => ({
      ...prev,
      accountId: String(accounts[0].id),
    }));
  }, [accounts, form.accountId]);

  useEffect(() => {
    if (!isEditorMode) {
      return;
    }

    if (isCreateMode) {
      resetForm();
      return;
    }

    if (!editingId) {
      return;
    }

    let active = true;
    const loadRecurringById = async () => {
      setIsEditorLoading(true);
      setErrorMessage(null);
      try {
        const item = await authenticatedRequest<RecurringTransactionResponse>(
          `/api/recurring-transactions/${editingId}`,
        );
        if (!active) {
          return;
        }

        setForm({
          type: item.type,
          name: item.description ?? "",
          accountId: String(item.account_id),
          categoryId: String(item.category_id),
          amount: item.amount,
          frequency: item.frequency,
          dayOfWeek: item.day_of_week !== null ? String(item.day_of_week) : "0",
          dayOfMonth: item.day_of_month !== null ? String(item.day_of_month) : "1",
          startDate: item.start_date,
          endDate: item.end_date ?? "",
        });
      } catch (error) {
        if (active) {
          setErrorMessage(getErrorMessage(error));
        }
      } finally {
        if (active) {
          setIsEditorLoading(false);
        }
      }
    };

    void loadRecurringById();
    return () => {
      active = false;
    };
  }, [authenticatedRequest, editingId, isCreateMode, isEditorMode, resetForm]);

  const closeEditor = () => {
    if (window.history.length > 1) {
      router.back();
      return;
    }
    router.push("/recurring");
  };

  const openCreateEditor = () => {
    router.push(buildHref("create", "1"));
  };

  const openEditEditor = (item: RecurringTransactionResponse) => {
    router.push(buildHref("edit", String(item.id)));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!form.name.trim() || !form.accountId || !form.categoryId || !form.amount) {
      setErrorMessage("Заполните обязательные поля: название, счет, категория и сумма.");
      return;
    }

    if (!editingId && !form.startDate) {
      setErrorMessage("Укажите дату начала.");
      return;
    }

    if (form.endDate && form.startDate && new Date(form.endDate) < new Date(form.startDate)) {
      setErrorMessage("Дата окончания не может быть раньше даты начала.");
      return;
    }

    if (form.frequency === "weekly" && form.dayOfWeek === "") {
      setErrorMessage("Для еженедельной операции выберите день недели.");
      return;
    }

    if (form.frequency === "monthly" && form.dayOfMonth === "") {
      setErrorMessage("Для ежемесячной операции укажите день месяца.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      if (editingId) {
        const updatePayload: RecurringTransactionUpdate = {
          amount: Number(form.amount),
          description: form.name.trim(),
          category_id: Number(form.categoryId),
          frequency: form.frequency,
          day_of_week: form.frequency === "weekly" ? Number(form.dayOfWeek) : null,
          day_of_month: form.frequency === "monthly" ? Number(form.dayOfMonth) : null,
          end_date: form.endDate || null,
        };

        await authenticatedRequest(`/api/recurring-transactions/${editingId}`, {
          method: "PATCH",
          body: updatePayload,
        });
      } else {
        const createPayload: RecurringTransactionCreate = {
          type: form.type,
          account_id: Number(form.accountId),
          category_id: Number(form.categoryId),
          amount: Number(form.amount),
          description: form.name.trim(),
          frequency: form.frequency,
          day_of_week: form.frequency === "weekly" ? Number(form.dayOfWeek) : null,
          day_of_month: form.frequency === "monthly" ? Number(form.dayOfMonth) : null,
          start_date: form.startDate,
          end_date: form.endDate || null,
        };

        await authenticatedRequest("/api/recurring-transactions", {
          method: "POST",
          body: createPayload,
        });
      }

      await refreshData(view);
      closeEditor();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (recurringId: number) => {
    const confirmed = window.confirm("Удалить регулярную операцию?");
    if (!confirmed) {
      return;
    }

    setErrorMessage(null);

    try {
      await authenticatedRequest(`/api/recurring-transactions/${recurringId}`, { method: "DELETE" });
      await refreshData(view);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  };

  const handleExecute = async (recurringId: number) => {
    setErrorMessage(null);

    try {
      await authenticatedRequest(`/api/recurring-transactions/${recurringId}/execute`, { method: "POST" });
      await refreshData(view);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  };

  const handleToggleActive = async (item: RecurringTransactionResponse) => {
    setErrorMessage(null);

    try {
      await authenticatedRequest(
        `/api/recurring-transactions/${item.id}/${item.is_active ? "deactivate" : "activate"}`,
        { method: "POST" },
      );
      await refreshData(view);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  };

  if (isEditorMode) {
    return (
      <section className="fixed inset-0 z-50 overscroll-contain bg-[var(--bg-app)]">
        <div className="mx-auto flex h-full w-full max-w-[430px] flex-col">
          <TransactionEditorHeader
            title={editingId ? "Изменить регулярный платеж" : "Новый регулярный платеж"}
            onBack={closeEditor}
            formId={FORM_ID}
            isSaving={isSubmitting}
          />

          <div className="flex-1 overflow-y-auto px-3 py-3">
            {isEditorLoading ? <LoadingState message="Загружаем шаблон платежа..." /> : null}

            {!isEditorLoading ? (
              <form id={FORM_ID} className="app-panel space-y-3 p-3" onSubmit={handleSubmit}>
                <section>
                  <p className="mb-1.5 text-base font-semibold text-[var(--text-primary)]">Тип операции</p>
                  {!editingId ? (
                    <SegmentedControl
                      options={[
                        { key: "expense", label: "Расход" },
                        { key: "income", label: "Доход" },
                      ]}
                      value={form.type}
                      onChange={(nextType) =>
                        setForm((prev) => ({
                          ...prev,
                          type: nextType as "income" | "expense",
                          categoryId: "",
                        }))
                      }
                    />
                  ) : (
                    <p className="rounded-xl border border-[color:var(--border-soft)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text-secondary)]">
                      Тип нельзя изменить в текущем API.
                    </p>
                  )}
                </section>

                <section>
                  <p className="mb-1.5 text-base font-semibold text-[var(--text-primary)]">Счет</p>
                  <div className="grid grid-cols-2 gap-2">
                    {accounts.map((account) => {
                      const Icon = getIconOption(account.icon).icon;
                      const active = form.accountId === String(account.id);
                      return (
                        <button
                          key={account.id}
                          type="button"
                          disabled={Boolean(editingId)}
                          className={`rounded-2xl border px-2.5 py-2 text-left transition ${
                            active
                              ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/10"
                              : "border-[color:var(--border-soft)] bg-[var(--bg-card)]"
                          } disabled:opacity-65`}
                          onClick={() => setForm((prev) => ({ ...prev, accountId: String(account.id) }))}
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className="inline-flex h-8 w-8 items-center justify-center rounded-xl"
                              style={{ backgroundColor: `${account.color}22`, color: account.color }}
                            >
                              <Icon className="h-4 w-4" />
                            </span>
                            <span className="truncate text-sm font-semibold text-[var(--text-primary)]">{account.name}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>

                <label className="block text-sm text-[var(--text-secondary)]">
                  Название
                  <input
                    className="mt-1 block w-full rounded-xl border border-[color:var(--border-soft)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none transition focus-visible:ring-2 focus-visible:ring-[var(--ring-primary)]"
                    value={form.name}
                    onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                    placeholder="Например: Spotify Premium"
                    required
                  />
                </label>

                <section>
                  <p className="mb-1.5 text-base font-semibold text-[var(--text-primary)]">Категория</p>
                  <div className="grid grid-cols-2 gap-2">
                    {formCategories.map((category) => {
                      const Icon = getIconOption(category.icon).icon;
                      const active = form.categoryId === String(category.id);
                      return (
                        <button
                          key={category.id}
                          type="button"
                          className={`rounded-2xl border px-2.5 py-2 text-left transition ${
                            active
                              ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/10"
                              : "border-[color:var(--border-soft)] bg-[var(--bg-card)]"
                          }`}
                          onClick={() => setForm((prev) => ({ ...prev, categoryId: String(category.id) }))}
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className="inline-flex h-8 w-8 items-center justify-center rounded-xl"
                              style={{ backgroundColor: `${category.color}22`, color: category.color }}
                            >
                              <Icon className="h-4 w-4" />
                            </span>
                            <span className="truncate text-sm font-semibold text-[var(--text-primary)]">
                              {category.name}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>

                <label className="block text-sm text-[var(--text-secondary)]">
                  Сумма
                  <input
                    className="mt-1 block w-full rounded-xl border border-[color:var(--border-soft)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text-primary)]"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={form.amount}
                    onChange={(event) => setForm((prev) => ({ ...prev, amount: event.target.value }))}
                    required
                  />
                </label>

                <section>
                  <p className="mb-1.5 text-base font-semibold text-[var(--text-primary)]">Периодичность</p>
                  <SegmentedControl
                    options={FREQUENCY_OPTIONS.map((item) => ({ key: item.key, label: item.label }))}
                    value={form.frequency}
                    onChange={(nextFrequency) =>
                      setForm((prev) => ({
                        ...prev,
                        frequency: nextFrequency as RecurringFrequency,
                        dayOfWeek:
                          nextFrequency === "weekly"
                            ? currentWeekdayValue()
                            : prev.dayOfWeek,
                        dayOfMonth:
                          nextFrequency === "monthly"
                            ? currentMonthDayValue()
                            : prev.dayOfMonth,
                      }))
                    }
                  />
                </section>

                {form.frequency === "weekly" ? (
                  <label className="block text-sm text-[var(--text-secondary)]">
                    День недели
                    <select
                      className="mt-1 block w-full rounded-xl border border-[color:var(--border-soft)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text-primary)]"
                      value={form.dayOfWeek}
                      onChange={(event) => setForm((prev) => ({ ...prev, dayOfWeek: event.target.value }))}
                      required
                    >
                      {WEEK_DAYS.map((day) => (
                        <option key={day.value} value={day.value}>
                          {day.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}

                {form.frequency === "monthly" ? (
                  <label className="block text-sm text-[var(--text-secondary)]">
                    День месяца
                    <input
                      className="mt-1 block w-full rounded-xl border border-[color:var(--border-soft)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text-primary)]"
                      type="number"
                      min="1"
                      max="31"
                      value={form.dayOfMonth}
                      onChange={(event) => setForm((prev) => ({ ...prev, dayOfMonth: event.target.value }))}
                      required
                    />
                  </label>
                ) : null}

                <section className="grid grid-cols-2 gap-2">
                  <label className="text-sm text-[var(--text-secondary)]">
                    Дата начала
                    <DatePicker
                      className="mt-1"
                      granularity="day"
                      value={toDateValue(form.startDate)}
                      isDisabled={Boolean(editingId)}
                      onChange={(value) =>
                        setForm((prev) => ({
                          ...prev,
                          startDate: fromDateValue(value),
                        }))
                      }
                    />
                  </label>
                  <label className="text-sm text-[var(--text-secondary)]">
                    Дата окончания
                    <DatePicker
                      className="mt-1"
                      granularity="day"
                      value={toDateValue(form.endDate)}
                      onChange={(value) =>
                        setForm((prev) => ({
                          ...prev,
                          endDate: fromDateValue(value),
                        }))
                      }
                    />
                  </label>
                </section>

                {errorMessage ? <ErrorState message={errorMessage} /> : null}
              </form>
            ) : null}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <section className="app-panel p-3">
        <h1 className="section-title text-[1.35rem]">Регулярные платежи</h1>
        <p className="section-caption">Управляйте подписками и регулярными доходами/расходами в одном месте.</p>
        <div className="mt-3 flex items-center justify-between gap-2">
          <Button color="primary" onPress={openCreateEditor}>
            Добавить
          </Button>
          <Button variant="flat" onPress={() => void refreshData(view)}>
            Обновить
          </Button>
        </div>
      </section>

      <SegmentedControl
        options={[
          { key: "all", label: "Все" },
          { key: "active", label: "Активные" },
          { key: "inactive", label: "На паузе" },
          { key: "pending", label: `К исполнению (${pendingItems.length})` },
        ]}
        value={view}
        onChange={setView}
      />

      {errorMessage ? <ErrorState className="mb-3" message={errorMessage} /> : null}

      <section className="space-y-3">
        {isLoading ? <LoadingState message="Загружаем регулярные операции..." /> : null}

        {!isLoading && selectedItems.length === 0 ? (
          <EmptyState
            message={view === "pending" ? "Нет операций, готовых к исполнению." : "Операции не найдены."}
          />
        ) : null}

        {!isLoading
          ? selectedItems.map((item) => {
              const account = accountById.get(item.account_id);
              const category = categoryById.get(item.category_id);
              const AccountIcon = account ? getIconOption(account.icon).icon : null;
              const CategoryIcon = category ? getIconOption(category.icon).icon : null;
              const isIncome = item.type === "income";
              const accountCurrency = account ? currencyByCode.get(account.currency_code) : null;

              return (
                <article
                  key={item.id}
                  className={`app-panel p-3 ${
                    item.is_active
                      ? "border-[color:var(--border-soft)] bg-[var(--bg-card)]"
                      : "border-[color:var(--border-soft)] bg-[color:color-mix(in_srgb,var(--bg-card)_78%,var(--surface-hover)_22%)]"
                  } ${focusRecurringId === item.id ? "ring-2 ring-secondary-300" : ""}`}
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${
                          isIncome
                              ? "border-success-400/40 bg-success-500/15 text-success-600 dark:text-success-300"
                              : "border-danger-400/40 bg-danger-500/15 text-danger-600 dark:text-danger-300"
                        }`}
                      >
                        {isIncome ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                        {isIncome ? "Доход" : "Расход"}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                          item.is_active
                            ? "bg-success-500/15 text-success-600 dark:text-success-300"
                            : "bg-[var(--surface-hover)] text-[var(--text-secondary)]"
                        }`}
                      >
                        {item.is_active ? <PlayCircle className="h-3.5 w-3.5" /> : <PauseCircle className="h-3.5 w-3.5" />}
                        {item.is_active ? "Активна" : "Пауза"}
                      </span>
                    </div>

                    <Dropdown>
                      <DropdownTrigger>
                        <Button isIconOnly size="sm" variant="light" aria-label="Действия">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownTrigger>
                      <DropdownMenu
                        aria-label="Действия с регулярной операцией"
                        onAction={(key) => {
                          if (key === "edit") {
                            openEditEditor(item);
                            return;
                          }

                          if (key === "execute") {
                            void handleExecute(item.id);
                            return;
                          }

                          if (key === "toggle") {
                            void handleToggleActive(item);
                            return;
                          }

                          if (key === "delete") {
                            void handleDelete(item.id);
                          }
                        }}
                      >
                        <DropdownItem key="edit">Изменить</DropdownItem>
                        <DropdownItem key="execute">Выполнить сейчас</DropdownItem>
                        <DropdownItem key="toggle">{item.is_active ? "Деактивировать" : "Активировать"}</DropdownItem>
                        <DropdownItem key="delete" className="text-danger" color="danger">
                          Удалить
                        </DropdownItem>
                      </DropdownMenu>
                    </Dropdown>
                  </div>

                  <div className="mb-2 flex items-center justify-between gap-2">
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
                      <span className="truncate text-sm font-medium text-[var(--text-primary)]">
                        {account?.name ?? "Счет не найден"}
                      </span>
                    </div>

                    <p
                      className={`text-right text-base font-semibold ${
                        isIncome ? "text-success-600 dark:text-success-300" : "text-danger-600 dark:text-danger-300"
                      }`}
                    >
                      {isIncome ? "+" : "-"}
                      {formatAmountWithCurrency(
                        item.amount,
                        accountCurrency?.code ?? account?.currency_code,
                        accountCurrency?.symbol,
                      )}
                    </p>
                  </div>

                  <div className="mb-2 flex items-center justify-between gap-2 text-xs text-[var(--text-secondary)]">
                    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-hover)] px-2 py-1">
                      <Repeat className="h-3.5 w-3.5" />
                      {frequencyLabel(item.frequency)}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-hover)] px-2 py-1">
                      <ClockArrowUp className="h-3.5 w-3.5" />
                      След.: {formatDate(item.next_execution_date)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      {category && CategoryIcon ? (
                        <span
                          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-black/10"
                          style={{
                            backgroundColor: toSoftBackground(category.color, 0.18),
                            color: category.color,
                          }}
                        >
                          <CategoryIcon className="h-4 w-4" />
                        </span>
                      ) : null}
                      <span className="truncate text-sm text-[var(--text-primary)]">
                        {item.description?.trim() || category?.name || "Без названия"}
                      </span>
                    </div>
                    {item.last_executed_at ? (
                      <span className="text-xs text-[var(--text-secondary)]">
                        Вып.: {formatDate(item.last_executed_at)}
                      </span>
                    ) : null}
                  </div>
                </article>
              );
            })
          : null}
      </section>
    </section>
  );
}
