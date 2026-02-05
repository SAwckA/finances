"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
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
  useDisclosure,
} from "@heroui/react";
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
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useAuth } from "@/features/auth/auth-context";
import { ApiError } from "@/lib/api-client";
import { getIconOption } from "@/lib/icon-catalog";
import type {
  AccountResponse,
  CategoryResponse,
  RecurringFrequency,
  RecurringTransactionCreate,
  RecurringTransactionResponse,
  RecurringTransactionUpdate,
} from "@/lib/types";

type RecurringView = "all" | "active" | "inactive" | "pending";

type RecurringFormState = {
  type: "income" | "expense";
  accountId: string;
  categoryId: string;
  amount: string;
  description: string;
  frequency: RecurringFrequency;
  dayOfWeek: string;
  dayOfMonth: string;
  startDate: string;
  endDate: string;
};

const WEEK_DAYS = [
  { value: "0", label: "Пн" },
  { value: "1", label: "Вт" },
  { value: "2", label: "Ср" },
  { value: "3", label: "Чт" },
  { value: "4", label: "Пт" },
  { value: "5", label: "Сб" },
  { value: "6", label: "Вс" },
];

function todayDateValue(): string {
  return new Date().toISOString().slice(0, 10);
}

const DEFAULT_FORM: RecurringFormState = {
  type: "expense",
  accountId: "",
  categoryId: "",
  amount: "",
  description: "",
  frequency: "monthly",
  dayOfWeek: "0",
  dayOfMonth: "1",
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

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
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

export default function RecurringPage() {
  const { authenticatedRequest } = useAuth();
  const [view, setView] = useState<RecurringView>("all");
  const [recurringItems, setRecurringItems] = useState<RecurringTransactionResponse[]>([]);
  const [pendingItems, setPendingItems] = useState<RecurringTransactionResponse[]>([]);
  const [accounts, setAccounts] = useState<AccountResponse[]>([]);
  const [categories, setCategories] = useState<CategoryResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<RecurringFormState>(DEFAULT_FORM);
  const { isOpen, onOpen, onOpenChange, onClose } = useDisclosure();

  const accountById = useMemo(
    () => new Map(accounts.map((account) => [account.id, account])),
    [accounts],
  );
  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  );

  const formCategories = useMemo(
    () => categories.filter((category) => category.type === form.type),
    [categories, form.type],
  );

  const selectedItems = view === "pending" ? pendingItems : recurringItems;

  const resetForm = useCallback(() => {
    setEditingId(null);
    setForm((prev) => ({
      ...DEFAULT_FORM,
      accountId: accounts[0] ? String(accounts[0].id) : "",
      categoryId: "",
      startDate: todayDateValue(),
      dayOfWeek: prev.dayOfWeek,
      dayOfMonth: prev.dayOfMonth,
    }));
  }, [accounts]);

  const loadReferenceData = useCallback(async () => {
    const [accountsData, categoriesData] = await Promise.all([
      authenticatedRequest<AccountResponse[]>("/api/accounts?skip=0&limit=300"),
      authenticatedRequest<CategoryResponse[]>("/api/categories?skip=0&limit=300"),
    ]);
    setAccounts(accountsData);
    setCategories(categoriesData);
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

  const openCreateModal = () => {
    resetForm();
    onOpen();
  };

  const openEditModal = (item: RecurringTransactionResponse) => {
    setEditingId(item.id);
    setForm({
      type: item.type,
      accountId: String(item.account_id),
      categoryId: String(item.category_id),
      amount: item.amount,
      description: item.description ?? "",
      frequency: item.frequency,
      dayOfWeek: item.day_of_week !== null ? String(item.day_of_week) : "0",
      dayOfMonth: item.day_of_month !== null ? String(item.day_of_month) : "1",
      startDate: item.start_date,
      endDate: item.end_date ?? "",
    });
    onOpen();
  };

  const closeModal = () => {
    onClose();
    resetForm();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!form.accountId || !form.categoryId || !form.amount) {
      setErrorMessage("Заполните обязательные поля: счет, категория и сумма.");
      return;
    }

    if (!editingId && !form.startDate) {
      setErrorMessage("Укажите дату начала.");
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
          description: form.description.trim() || null,
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
          description: form.description.trim() || null,
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

      closeModal();
      await refreshData(view);
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

  return (
    <section className="space-y-3">
      <section className="mobile-card p-3">
        <h1 className="section-title text-[1.35rem]">Recurring Transactions</h1>
        <p className="section-caption">Automate repeating income and expenses with one control panel.</p>
        <div className="mt-3 flex items-center justify-between gap-2">
          <Button color="primary" onPress={openCreateModal}>
            New recurring
          </Button>
          <Button variant="flat" onPress={() => void refreshData(view)}>
            Refresh
          </Button>
        </div>
      </section>

      <SegmentedControl
        options={[
          { key: "all", label: "All" },
          { key: "active", label: "Active" },
          { key: "inactive", label: "Paused" },
          { key: "pending", label: `Pending (${pendingItems.length})` },
        ]}
        value={view}
        onChange={setView}
      />

      {errorMessage ? <ErrorState className="mb-3" message={errorMessage} /> : null}

      <section className="space-y-3">
        {isLoading ? (
          <LoadingState message="Загружаем регулярные операции..." />
        ) : null}

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

              return (
                <article
                  key={item.id}
                  className={`mobile-card p-3 ${
                    item.is_active ? "border-slate-200 bg-white" : "border-slate-200 bg-slate-50/70"
                  }`}
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${
                          isIncome
                            ? "border-emerald-300 bg-emerald-100 text-emerald-800"
                            : "border-rose-300 bg-rose-100 text-rose-800"
                        }`}
                      >
                        {isIncome ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                        {isIncome ? "Доход" : "Расход"}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                          item.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"
                        }`}
                      >
                        {item.is_active ? (
                          <PlayCircle className="h-3.5 w-3.5" />
                        ) : (
                          <PauseCircle className="h-3.5 w-3.5" />
                        )}
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
                            openEditModal(item);
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
                        <DropdownItem key="toggle">
                          {item.is_active ? "Деактивировать" : "Активировать"}
                        </DropdownItem>
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
                      <span className="truncate text-sm font-medium text-slate-800">
                        {account?.name ?? "Счет не найден"}
                      </span>
                    </div>

                    <p className={`text-right text-base font-semibold ${isIncome ? "text-emerald-700" : "text-rose-700"}`}>
                      {isIncome ? "+" : "-"}
                      {formatAmount(item.amount)}
                    </p>
                  </div>

                  <div className="mb-2 flex items-center justify-between gap-2 text-xs text-slate-600">
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1">
                      <Repeat className="h-3.5 w-3.5" />
                      {frequencyLabel(item.frequency)}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1">
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
                      <span className="truncate text-sm text-slate-700">{category?.name ?? "Категория не найдена"}</span>
                    </div>
                    {item.last_executed_at ? (
                      <span className="text-xs text-slate-500">Вып.: {formatDate(item.last_executed_at)}</span>
                    ) : null}
                  </div>
                </article>
              );
            })
          : null}
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
            <ModalHeader>{editingId ? "Изменить регулярную операцию" : "Новая регулярная операция"}</ModalHeader>
            <ModalBody className="space-y-2">
              <label className="block text-sm text-slate-700">
                Тип *
                <select
                  className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                  value={form.type}
                  disabled={Boolean(editingId)}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      type: event.target.value as "income" | "expense",
                      categoryId: "",
                    }))
                  }
                >
                  <option value="expense">Расход</option>
                  <option value="income">Доход</option>
                </select>
                {editingId ? (
                  <span className="mt-1 block text-xs text-slate-500">Тип нельзя изменить в текущем API.</span>
                ) : null}
              </label>

              <label className="block text-sm text-slate-700">
                Счет *
                <select
                  className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                  value={form.accountId}
                  disabled={Boolean(editingId)}
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
              </label>

              <label className="block text-sm text-slate-700">
                Категория *
                <select
                  className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                  value={form.categoryId}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      categoryId: event.target.value,
                    }))
                  }
                  required
                >
                  <option value="">Выберите категорию</option>
                  {formCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>

              <Input
                label="Сумма *"
                type="number"
                step="0.01"
                min="0.01"
                value={form.amount}
                onValueChange={(value) => setForm((prev) => ({ ...prev, amount: value }))}
                required
              />

              <label className="block text-sm text-slate-700">
                Частота *
                <select
                  className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                  value={form.frequency}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      frequency: event.target.value as RecurringFrequency,
                    }))
                  }
                >
                  <option value="daily">Ежедневно</option>
                  <option value="weekly">Еженедельно</option>
                  <option value="monthly">Ежемесячно</option>
                </select>
              </label>

              {form.frequency === "weekly" ? (
                <label className="block text-sm text-slate-700">
                  День недели *
                  <select
                    className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                    value={form.dayOfWeek}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        dayOfWeek: event.target.value,
                      }))
                    }
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
                <Input
                  label="День месяца *"
                  type="number"
                  min="1"
                  max="31"
                  value={form.dayOfMonth}
                  onValueChange={(value) =>
                    setForm((prev) => ({
                      ...prev,
                      dayOfMonth: value,
                    }))
                  }
                  required
                />
              ) : null}

              <label className="block text-sm text-slate-700">
                Дата начала *
                <input
                  className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                  type="date"
                  value={form.startDate}
                  disabled={Boolean(editingId)}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      startDate: event.target.value,
                    }))
                  }
                  required
                />
                {editingId ? (
                  <span className="mt-1 block text-xs text-slate-500">Дата начала не меняется через PATCH.</span>
                ) : null}
              </label>

              <label className="block text-sm text-slate-700">
                Дата окончания
                <input
                  className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                  type="date"
                  value={form.endDate}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      endDate: event.target.value,
                    }))
                  }
                />
              </label>

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
                {editingId ? "Сохранить" : "Создать"}
              </Button>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>
    </section>
  );
}
