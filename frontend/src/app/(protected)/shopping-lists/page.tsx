"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Accordion,
  AccordionItem,
  Button,
  Input,
  useDisclosure,
} from "@heroui/react";
import { ChevronLeft, Plus, Trash2 } from "lucide-react";
import { EmptyState, ErrorState, LoadingState } from "@/components/async-state";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { TransactionEditorHeader } from "@/components/transactions/transaction-editor-header";
import { useAuth } from "@/features/auth/auth-context";
import { ApiError } from "@/lib/api-client";
import { getIconOption } from "@/lib/icon-catalog";
import type {
  AccountResponse,
  CategoryResponse,
  CurrencyResponse,
  ShoppingListCreate,
  ShoppingListResponse,
  ShoppingListStatus,
  ShoppingListUpdate,
} from "@/lib/types";

type StatusFilter = ShoppingListStatus | "all";

type ListFormState = {
  name: string;
  accountId: string;
  categoryId: string;
};

const FORM_ID = "shopping-list-form";

const DEFAULT_LIST_FORM: ListFormState = {
  name: "",
  accountId: "",
  categoryId: "",
};

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return `Ошибка API (${error.status}). Проверьте данные и попробуйте снова.`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Что-то пошло не так. Попробуйте снова.";
}

function formatAmount(value: string | null, currencyCode: string): string {
  if (!value) {
    return "—";
  }

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

function shortAccountBadge(account: AccountResponse | null): string | null {
  if (!account?.short_identifier) {
    return null;
  }
  return account.short_identifier;
}

function statusMeta(status: ShoppingListStatus): { label: string; className: string } {
  if (status === "confirmed") {
    return {
      label: "Подтвержден",
      className: "border-blue-300 bg-blue-100 text-blue-800",
    };
  }

  if (status === "completed") {
    return {
      label: "Завершен",
      className: "border-emerald-300 bg-emerald-100 text-emerald-800",
    };
  }

  return {
    label: "Черновик",
    className: "border-amber-300 bg-amber-100 text-amber-800",
  };
}

export default function ShoppingListsPage() {
  const { authenticatedRequest } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [lists, setLists] = useState<ShoppingListResponse[]>([]);
  const [accounts, setAccounts] = useState<AccountResponse[]>([]);
  const [categories, setCategories] = useState<CategoryResponse[]>([]);
  const [currencies, setCurrencies] = useState<CurrencyResponse[]>([]);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [editingListId, setEditingListId] = useState<number | null>(null);
  const [listForm, setListForm] = useState<ListFormState>(DEFAULT_LIST_FORM);

  const accountById = useMemo(
    () => new Map(accounts.map((account) => [account.id, account])),
    [accounts],
  );
  const currencyById = useMemo(
    () => new Map(currencies.map((currency) => [currency.id, currency])),
    [currencies],
  );
  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  );
  const expenseCategories = useMemo(
    () => categories.filter((category) => category.type === "expense"),
    [categories],
  );

  const loadData = useCallback(async () => {
    setErrorMessage(null);
    setIsRefreshing(true);

    try {
      const statusQuery = filter === "all" ? "" : `?status=${filter}`;
      const [listsData, accountsData, categoriesData, currenciesData] = await Promise.all([
        authenticatedRequest<ShoppingListResponse[]>(`/api/shopping-lists${statusQuery}`),
        authenticatedRequest<AccountResponse[]>("/api/accounts?skip=0&limit=300"),
        authenticatedRequest<CategoryResponse[]>("/api/categories?skip=0&limit=300"),
        authenticatedRequest<CurrencyResponse[]>("/api/currencies?skip=0&limit=300"),
      ]);

      setLists(listsData);
      setAccounts(accountsData);
      setCategories(categoriesData);
      setCurrencies(currenciesData);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [authenticatedRequest, filter]);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    const openParam = searchParams.get("open");
    if (!openParam) {
      return;
    }
    const parsed = Number(openParam);
    if (Number.isFinite(parsed)) {
      router.replace(`/shopping-lists/${parsed}`);
    }
  }, [router, searchParams]);

  const resetListForm = () => {
    setEditingListId(null);
    setListForm({
      ...DEFAULT_LIST_FORM,
      accountId: accounts[0] ? String(accounts[0].id) : "",
      categoryId: expenseCategories[0] ? String(expenseCategories[0].id) : "",
    });
  };

  const openCreateModal = () => {
    resetListForm();
    onOpen();
  };

  const openEditModal = (list: ShoppingListResponse) => {
    setEditingListId(list.id);
    setListForm({
      name: list.name,
      accountId: String(list.account_id),
      categoryId: String(list.category_id),
    });
    onOpen();
  };

  const closeModal = () => {
    onClose();
    resetListForm();
  };

  const handleSaveList = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!listForm.name || !listForm.accountId || !listForm.categoryId) {
      setErrorMessage("Укажите название, счет и категорию.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      if (editingListId) {
        const payload: ShoppingListUpdate = {
          name: listForm.name.trim(),
          account_id: Number(listForm.accountId),
          category_id: Number(listForm.categoryId),
        };
        await authenticatedRequest(`/api/shopping-lists/${editingListId}`, {
          method: "PATCH",
          body: payload,
        });
      } else {
        const payload: ShoppingListCreate = {
          name: listForm.name.trim(),
          account_id: Number(listForm.accountId),
          category_id: Number(listForm.categoryId),
          items: [],
        };
        await authenticatedRequest("/api/shopping-lists", { method: "POST", body: payload });
      }

      closeModal();
      await loadData();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteList = async (listId: number) => {
    if (!window.confirm("Удалить список покупок?")) {
      return;
    }

    setErrorMessage(null);
    try {
      await authenticatedRequest(`/api/shopping-lists/${listId}`, { method: "DELETE" });
      await loadData();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  };

  const handleTransition = async (listId: number, action: "confirm" | "complete") => {
    setErrorMessage(null);

    try {
      await authenticatedRequest(`/api/shopping-lists/${listId}/${action}`, { method: "POST" });
      await loadData();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  };

  return (
    <section className="fixed inset-0 z-40 overscroll-contain bg-[var(--bg-app)]">
      <div className="mx-auto flex h-full w-full max-w-[430px] flex-col">
        <header className="sticky top-0 z-10 rounded-[var(--radius-lg)] border-b border-[color:var(--border-soft)] bg-[color:color-mix(in_srgb,var(--bg-card)_88%,transparent)] px-3 py-2.5 backdrop-blur">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={handleBack}
              className="surface-hover tap-highlight-none inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[color:var(--border-soft)] bg-[var(--bg-card)] text-[var(--text-secondary)] transition"
              aria-label="Back"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            </button>
            <h2 className="text-base font-bold text-[var(--text-primary)]">Shopping Lists</h2>
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center gap-1 rounded-xl bg-[var(--accent-primary)] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent-primary-strong)]"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              New list
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-3 py-3">
          <section className="space-y-3">
            <section className="mobile-card p-3">
              <p className="text-sm font-semibold text-[var(--text-primary)]">Manage shopping flows</p>
              <p className="section-caption">Draft, confirm, complete and post spending automatically.</p>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex gap-2">
                  <Button size="sm" variant="flat" isLoading={isRefreshing} onPress={() => void loadData()}>
                    Refresh
                  </Button>
                </div>
              </div>
            </section>

            <SegmentedControl
              options={[
                { key: "all", label: "All" },
                { key: "draft", label: "Draft" },
                { key: "confirmed", label: "Confirmed" },
                { key: "completed", label: "Completed" },
              ]}
              value={filter}
              onChange={setFilter}
            />

            {errorMessage ? <ErrorState className="mb-3" message={errorMessage} /> : null}

            <section>
              {isLoading ? (
                <LoadingState message="Загружаем списки..." />
              ) : null}

              {!isLoading && lists.length === 0 ? (
                <EmptyState message="Списков пока нет." />
              ) : null}

              {!isLoading && lists.length > 0 ? (
                <Accordion variant="bordered" isCompact>
                  {lists.map((list) => {
                    const status = statusMeta(list.status);
                    const account = accountById.get(list.account_id);
                    const currency = account ? currencyById.get(account.currency_id) : null;
                    const category = categoryById.get(list.category_id);
                    return (
                      <AccordionItem
                        key={list.id}
                        aria-label={`Список ${list.name}`}
                        title={
                          <div className="flex items-start justify-between gap-2 pr-1">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{list.name}</p>
                              <p className="truncate text-xs text-[var(--text-secondary)]">
                                {account?.name ?? "Счет"} · {category?.name ?? "Категория"}
                              </p>
                            </div>
                            <span
                              className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${status.className}`}
                            >
                              {status.label}
                            </span>
                          </div>
                        }
                        subtitle={
                          <p className="text-xs text-[var(--text-secondary)]">
                            Итого: {formatAmount(list.total_amount, currency?.code ?? "RUB")}
                          </p>
                        }
                      >
                        <div className="space-y-3">
                          <div className="flex flex-wrap gap-2">
                            <Button size="sm" variant="flat" onPress={() => openEditModal(list)}>
                              Изменить
                            </Button>
                            <Link
                              href={`/shopping-lists/${list.id}`}
                              className="inline-flex items-center gap-2 rounded-xl border border-[color:var(--border-soft)] bg-[var(--bg-card)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]"
                            >
                              Открыть
                            </Link>
                            {list.status === "draft" ? (
                              <Button
                                size="sm"
                                color="primary"
                                variant="flat"
                                onPress={() => void handleTransition(list.id, "confirm")}
                              >
                                Подтвердить
                              </Button>
                            ) : null}
                            {list.status === "confirmed" ? (
                              <Button
                                size="sm"
                                color="success"
                                variant="flat"
                                onPress={() => void handleTransition(list.id, "complete")}
                              >
                                Завершить
                              </Button>
                            ) : null}
                            <Button
                              size="sm"
                              color="danger"
                              variant="flat"
                              onPress={() => void handleDeleteList(list.id)}
                            >
                              Удалить
                            </Button>
                          </div>

                          <div className="space-y-2">
                            <div className="flex items-center justify-between rounded-xl border border-[color:var(--border-soft)] bg-[var(--bg-card)] px-2.5 py-2">
                              <span className="text-xs font-semibold text-[var(--text-secondary)]">
                                Товаров: {list.items.length}
                              </span>
                              <span className="text-xs font-semibold text-[var(--text-secondary)]">
                                Итого: {formatAmount(list.total_amount, currency?.code ?? "RUB")}
                              </span>
                            </div>
                          </div>
                        </div>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              ) : null}
            </section>
          </section>
        </div>

        {isOpen ? (
          <section className="fixed inset-0 z-50 overscroll-contain bg-[var(--bg-app)]">
            <div className="mx-auto flex h-full w-full max-w-[430px] flex-col">
              <TransactionEditorHeader
                title={editingListId ? "Edit List" : "New List"}
                onBack={closeModal}
                formId={FORM_ID}
                isSaving={isSubmitting}
              />
              <div className="flex-1 overflow-y-auto px-3 py-3">
                <form id={FORM_ID} className="mobile-card space-y-3 p-3" onSubmit={handleSaveList}>
                  <label className="block text-sm text-[var(--text-secondary)]">
                    Название
                    <input
                      className="mt-1 block w-full rounded-xl border border-[color:var(--border-soft)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none transition focus-visible:ring-2 focus-visible:ring-[var(--ring-primary)]"
                      value={listForm.name}
                      name="listName"
                      autoComplete="off"
                      onChange={(event) => setListForm((prev) => ({ ...prev, name: event.target.value }))}
                      placeholder="Название списка…"
                      required
                    />
                  </label>

                  <section>
                    <p className="mb-1.5 text-sm font-semibold text-[var(--text-secondary)]">Счет</p>
                    <div className="grid grid-cols-2 gap-2">
                      {accounts.map((account) => {
                        const selected = String(account.id) === listForm.accountId;
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
                              setListForm((prev) => ({
                                ...prev,
                                accountId: String(account.id),
                              }))
                            }
                          >
                            <span
                              className="inline-flex h-9 w-9 items-center justify-center rounded-xl"
                              style={{ backgroundColor: `${account.color}22`, color: account.color }}
                            >
                              <Icon className="h-4.5 w-4.5" aria-hidden="true" />
                            </span>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="truncate text-xs font-semibold text-[var(--text-primary)]">
                                  {account.name}
                                </span>
                                {badge ? (
                                  <span className="badge">{badge}</span>
                                ) : (
                                  <span className="text-xs text-[var(--text-secondary)]">No ID</span>
                                )}
                              </div>
                              <span className="mt-1 block text-xs text-[var(--text-secondary)]">
                                {account.type ?? "Payment source"}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </section>

                  <section>
                    <p className="mb-1.5 text-sm font-semibold text-[var(--text-secondary)]">Категория расходов</p>
                    <div className="grid grid-cols-2 gap-2">
                      {expenseCategories.map((category) => {
                        const selected = String(category.id) === listForm.categoryId;
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
                              setListForm((prev) => ({
                                ...prev,
                                categoryId: String(category.id),
                              }))
                            }
                          >
                            <span
                              className="inline-flex h-9 w-9 items-center justify-center rounded-xl"
                              style={{ backgroundColor: `${category.color}22`, color: category.color }}
                            >
                              <Icon className="h-4.5 w-4.5" aria-hidden="true" />
                            </span>
                            <span className="text-sm font-semibold text-[var(--text-primary)]">
                              {category.name}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </section>

                  {errorMessage ? <ErrorState message={errorMessage} /> : null}
                </form>
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </section>
  );
}
