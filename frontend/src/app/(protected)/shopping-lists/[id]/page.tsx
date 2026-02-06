"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@heroui/react";
import { Check, ChevronLeft, Trash2 } from "lucide-react";
import { EmptyState, ErrorState, LoadingState } from "@/components/async-state";
import { useAuth } from "@/features/auth/auth-context";
import { ApiError } from "@/lib/api-client";
import { getIconOption } from "@/lib/icon-catalog";
import type {
  AccountResponse,
  AccountBalanceResponse,
  CategoryResponse,
  CurrencyResponse,
  ShoppingItemCreate,
  ShoppingItemResponse,
  ShoppingListResponse,
  ShoppingListStatus,
} from "@/lib/types";

type ItemDraftState = {
  name: string;
  quantity: string;
};

const DEFAULT_ITEM_DRAFT: ItemDraftState = {
  name: "",
  quantity: "1",
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

function computeTotal(items: ShoppingItemResponse[]): number {
  return items.reduce((sum, item) => {
    if (item.total_price === null || item.total_price === undefined) {
      return sum;
    }
    return sum + Number(item.total_price);
  }, 0);
}

function statusMeta(status: ShoppingListStatus): { label: string; className: string } {
  if (status === "confirmed") {
    return {
      label: "Подтвержден",
      className:
        "border-[color:var(--status-blue-border)] bg-[color:var(--status-blue-bg)] text-[color:var(--status-blue-text)]",
    };
  }

  if (status === "completed") {
    return {
      label: "Завершен",
      className:
        "border-[color:var(--status-green-border)] bg-[color:var(--status-green-bg)] text-[color:var(--status-green-text)]",
    };
  }

  return {
    label: "Черновик",
    className:
      "border-[color:var(--status-amber-border)] bg-[color:var(--status-amber-bg)] text-[color:var(--status-amber-text)]",
  };
}

function shortAccountBadge(account: AccountResponse | null): string | null {
  if (!account?.short_identifier) {
    return null;
  }
  return account.short_identifier;
}

function badgeStyle(color: string | undefined): CSSProperties | undefined {
  if (!color) {
    return undefined;
  }

  return {
    backgroundColor: `${color}1a`,
    borderColor: `${color}55`,
    color,
  };
}

export default function ShoppingListDetailPage() {
  const { authenticatedRequest } = useAuth();
  const router = useRouter();
  const params = useParams();
  const listId = Number(params?.id);
  const [list, setList] = useState<ShoppingListResponse | null>(null);
  const [accounts, setAccounts] = useState<AccountResponse[]>([]);
  const [accountBalances, setAccountBalances] = useState<AccountBalanceResponse[]>([]);
  const [categories, setCategories] = useState<CategoryResponse[]>([]);
  const [currencies, setCurrencies] = useState<CurrencyResponse[]>([]);
  const [itemDraft, setItemDraft] = useState<ItemDraftState>(DEFAULT_ITEM_DRAFT);
  const [isCreatingItem, setIsCreatingItem] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [itemPendingKey, setItemPendingKey] = useState<string | null>(null);
  const [isAccountPickerOpen, setIsAccountPickerOpen] = useState(false);
  const [isCategoryPickerOpen, setIsCategoryPickerOpen] = useState(false);
  const [isMetaSaving, setIsMetaSaving] = useState(false);
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [editingField, setEditingField] = useState<"name" | "quantity" | null>(null);
  const [editingName, setEditingName] = useState<string>("");
  const [editingQuantity, setEditingQuantity] = useState<string>("");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editingTitle, setEditingTitle] = useState("");

  const accountById = useMemo(
    () => new Map(accounts.map((account) => [account.id, account])),
    [accounts],
  );
  const balanceByAccountId = useMemo(
    () => new Map(accountBalances.map((balance) => [balance.account_id, balance])),
    [accountBalances],
  );
  const currencyById = useMemo(
    () => new Map(currencies.map((currency) => [currency.id, currency])),
    [currencies],
  );
  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  );

  const loadData = useCallback(async () => {
    if (!Number.isFinite(listId)) {
      setErrorMessage("Некорректный идентификатор списка.");
      setIsLoading(false);
      return;
    }

    setErrorMessage(null);
    setIsRefreshing(true);

    try {
      const [listData, accountsData, categoriesData, currenciesData, balancesData] =
        await Promise.all([
          authenticatedRequest<ShoppingListResponse>(`/api/shopping-lists/${listId}`),
          authenticatedRequest<AccountResponse[]>("/api/accounts?skip=0&limit=300"),
          authenticatedRequest<CategoryResponse[]>("/api/categories?skip=0&limit=300"),
          authenticatedRequest<CurrencyResponse[]>("/api/currencies?skip=0&limit=300"),
          authenticatedRequest<AccountBalanceResponse[]>("/api/statistics/balance"),
        ]);

      setList(listData);
      setAccounts(accountsData);
      setCategories(categoriesData);
      setCurrencies(currenciesData);
      setAccountBalances(balancesData);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [authenticatedRequest, listId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleTransition = async (action: "confirm" | "complete" | "draft") => {
    if (!list) {
      return;
    }
    setErrorMessage(null);
    setItemPendingKey(`${action}:${list.id}`);

    try {
      await authenticatedRequest(`/api/shopping-lists/${list.id}/${action}`, { method: "POST" });
      await loadData();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setItemPendingKey(null);
    }
  };

  const handleDeleteList = async () => {
    if (!list) {
      return;
    }
    const confirmed = window.confirm("Удалить список покупок?");
    if (!confirmed) {
      return;
    }

    setErrorMessage(null);
    try {
      await authenticatedRequest(`/api/shopping-lists/${list.id}`, { method: "DELETE" });
      router.back();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  };

  const openTitleEditor = () => {
    if (!list || list.status === "completed") {
      return;
    }
    setIsEditingTitle(true);
    setEditingTitle(list.name);
  };

  const closeTitleEditor = () => {
    setIsEditingTitle(false);
    setEditingTitle("");
  };

  const handleUpdateListName = async () => {
    if (!list) {
      return;
    }
    const trimmed = editingTitle.trim();
    if (!trimmed) {
      setErrorMessage("Введите название списка.");
      return;
    }
    setErrorMessage(null);
    setIsMetaSaving(true);
    try {
      await authenticatedRequest(`/api/shopping-lists/${list.id}`, {
        method: "PATCH",
        body: { name: trimmed },
      });
      closeTitleEditor();
      await loadData();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsMetaSaving(false);
    }
  };

  const handleUpdateListMeta = async (payload: Partial<{ account_id: number; category_id: number }>) => {
    if (!list) {
      return;
    }
    setErrorMessage(null);
    setIsMetaSaving(true);
    try {
      await authenticatedRequest(`/api/shopping-lists/${list.id}`, {
        method: "PATCH",
        body: payload,
      });
      setIsAccountPickerOpen(false);
      setIsCategoryPickerOpen(false);
      await loadData();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsMetaSaving(false);
    }
  };

  const handleAddItem = async () => {
    if (!list) {
      return;
    }
    if (!itemDraft.name.trim()) {
      setErrorMessage("Введите название товара.");
      return;
    }

    setErrorMessage(null);
    setItemPendingKey(`add:${list.id}`);
    try {
      const payload: ShoppingItemCreate = {
        name: itemDraft.name.trim(),
        quantity: Math.max(1, Number(itemDraft.quantity) || 1),
        price: null,
      };
      await authenticatedRequest(`/api/shopping-lists/${list.id}/items`, { method: "POST", body: payload });
      setItemDraft(DEFAULT_ITEM_DRAFT);
      setIsCreatingItem(false);
      await loadData();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setItemPendingKey(null);
    }
  };

  const handleDeleteItem = async (itemId: number) => {
    if (!list) {
      return;
    }
    setErrorMessage(null);
    setItemPendingKey(`delete:${itemId}`);
    try {
      await authenticatedRequest(`/api/shopping-lists/${list.id}/items/${itemId}`, { method: "DELETE" });
      await loadData();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setItemPendingKey(null);
    }
  };

  const handleToggleItem = async (item: ShoppingItemResponse) => {
    if (!list || list.status !== "confirmed") {
      return;
    }
    setErrorMessage(null);
    setItemPendingKey(`check:${item.id}`);
    try {
      await authenticatedRequest(`/api/shopping-lists/${list.id}/items/${item.id}`, {
        method: "PATCH",
        body: { is_checked: !item.is_checked },
      });
      await loadData();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setItemPendingKey(null);
    }
  };

  const openItemEditor = (item: ShoppingItemResponse, field: "name" | "quantity") => {
    if (list?.status !== "draft") {
      return;
    }
    setEditingItemId(item.id);
    setEditingField(field);
    setEditingName(item.name);
    setEditingQuantity(String(item.quantity));
  };

  const closeItemEditor = () => {
    setEditingItemId(null);
    setEditingField(null);
    setEditingName("");
    setEditingQuantity("");
  };

  const openNewItemEditor = () => {
    if (list?.status !== "draft") {
      return;
    }
    setIsCreatingItem(true);
    setItemDraft((prev) => ({
      ...prev,
      name: "",
      quantity: prev.quantity || "1",
    }));
  };

  const closeNewItemEditor = () => {
    setIsCreatingItem(false);
    setItemDraft(DEFAULT_ITEM_DRAFT);
  };

  const handleUpdateItemName = async (itemId: number) => {
    if (!list) {
      return;
    }
    const trimmed = editingName.trim();
    if (!trimmed) {
      setErrorMessage("Введите название товара.");
      return;
    }
    setErrorMessage(null);
    setItemPendingKey(`name:${itemId}`);
    try {
      await authenticatedRequest(`/api/shopping-lists/${list.id}/items/${itemId}`, {
        method: "PATCH",
        body: { name: trimmed },
      });
      closeItemEditor();
      await loadData();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setItemPendingKey(null);
    }
  };

  const handleUpdateItemQuantity = async (itemId: number) => {
    if (!list) {
      return;
    }
    const normalized = editingQuantity.trim();
    const parsed = Number(normalized);
    if (!Number.isFinite(parsed) || parsed < 1) {
      setErrorMessage("Количество должно быть больше нуля.");
      return;
    }
    setErrorMessage(null);
    setItemPendingKey(`qty:${itemId}`);
    try {
      await authenticatedRequest(`/api/shopping-lists/${list.id}/items/${itemId}`, {
        method: "PATCH",
        body: { quantity: Math.floor(parsed) },
      });
      closeItemEditor();
      await loadData();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setItemPendingKey(null);
    }
  };

  const handleUpdateItemPrice = async (itemId: number, rawValue: string) => {
    if (!list) {
      return;
    }

    const normalized = rawValue.replace(",", ".").trim();
    const price = normalized === "" ? null : Number(normalized);
    if (price !== null && Number.isNaN(price)) {
      setErrorMessage("Введите корректную цену.");
      return;
    }

    setErrorMessage(null);
    setItemPendingKey(`price:${itemId}`);
    try {
      await authenticatedRequest(`/api/shopping-lists/${list.id}/items/${itemId}`, {
        method: "PATCH",
        body: { price },
      });
      await loadData();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setItemPendingKey(null);
    }
  };

  const account = list ? accountById.get(list.account_id) : null;
  const category = list ? categoryById.get(list.category_id) : null;
  const currency = account ? currencyById.get(account.currency_id) : null;
  const status = list ? statusMeta(list.status) : null;
  const CategoryIcon = category ? getIconOption(category.icon).icon : null;
  const AccountIcon = account ? getIconOption(account.icon).icon : null;
  const totalOverride =
    list && (list.total_amount === null || list.total_amount === undefined)
      ? computeTotal(list.items)
      : null;

  return (
    <section className="fixed inset-0 z-50 overscroll-contain bg-[var(--bg-app)]">
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
            <h2 className="text-base font-bold text-[var(--text-primary)]">Shopping List</h2>
            <div className="w-[72px]" aria-hidden="true" />
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-3 py-3">
          {errorMessage ? <ErrorState className="mb-3" message={errorMessage} /> : null}

          {isLoading ? <LoadingState message="Загружаем список..." /> : null}

          {!isLoading && !list ? <EmptyState message="Список не найден." /> : null}

          {!isLoading && list ? (
            <section className="space-y-3">
              <section
                className="mobile-card space-y-2 p-3"
                style={{
                  ["--status-blue-border" as string]: "color-mix(in srgb, #60a5fa 55%, transparent)",
                  ["--status-blue-bg" as string]: "color-mix(in srgb, #60a5fa 18%, transparent)",
                  ["--status-blue-text" as string]: "color-mix(in srgb, #1d4ed8 85%, var(--text-primary))",
                  ["--status-green-border" as string]: "color-mix(in srgb, #34d399 55%, transparent)",
                  ["--status-green-bg" as string]: "color-mix(in srgb, #34d399 18%, transparent)",
                  ["--status-green-text" as string]: "color-mix(in srgb, #047857 85%, var(--text-primary))",
                  ["--status-amber-border" as string]: "color-mix(in srgb, #f59e0b 55%, transparent)",
                  ["--status-amber-bg" as string]: "color-mix(in srgb, #f59e0b 18%, transparent)",
                  ["--status-amber-text" as string]: "color-mix(in srgb, #b45309 85%, var(--text-primary))",
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  {isEditingTitle ? (
                    <input
                      className="w-full bg-transparent text-base font-semibold text-[var(--text-primary)] outline-none"
                      value={editingTitle}
                      onChange={(event) => setEditingTitle(event.target.value)}
                      onBlur={() => void handleUpdateListName()}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          void handleUpdateListName();
                        }
                        if (event.key === "Escape") {
                          event.preventDefault();
                          closeTitleEditor();
                        }
                      }}
                      autoFocus
                    />
                  ) : (
                    <button
                      type="button"
                      className="min-w-0 text-left text-base font-semibold text-[var(--text-primary)]"
                      onClick={openTitleEditor}
                      disabled={list.status === "completed"}
                    >
                      <span className="truncate">{list.name}</span>
                    </button>
                  )}
                  {status ? (
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${status.className}`}>
                      {status.label}
                    </span>
                  ) : null}
                </div>

                <div className="mt-2 space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      className="flex w-full min-w-0 items-center gap-2 rounded-full border border-[color:var(--border-soft)] bg-[var(--bg-card)] px-3 py-1.5 text-left transition hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring-primary)]"
                      onClick={() => {
                        setIsAccountPickerOpen((prev) => !prev);
                        setIsCategoryPickerOpen(false);
                      }}
                    >
                      <span
                        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                        style={{
                          backgroundColor: account?.color ? `${account.color}22` : "var(--surface-hover)",
                          color: account?.color ?? "var(--text-secondary)",
                        }}
                      >
                        {AccountIcon ? (
                          <AccountIcon className="h-3.5 w-3.5" aria-hidden="true" />
                        ) : (
                          <span className="text-xs font-semibold">{account?.name?.[0] ?? "A"}</span>
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
                          {account?.name ?? "Счет не найден"}
                        </p>
                      </div>
                      {shortAccountBadge(account) ? (
                        <span className="badge shrink-0" style={badgeStyle(account?.color)}>
                          {shortAccountBadge(account)}
                        </span>
                      ) : null}
                    </button>
                    {category ? (
                      <button
                        type="button"
                        className="flex w-full min-w-0 items-center gap-2 rounded-full border border-[color:var(--border-soft)] bg-[var(--bg-card)] px-3 py-1.5 text-left transition hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring-primary)]"
                        onClick={() => {
                          setIsCategoryPickerOpen((prev) => !prev);
                          setIsAccountPickerOpen(false);
                        }}
                      >
                        <span
                          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                          style={{
                            backgroundColor: `${category.color}22`,
                            color: category.color,
                          }}
                        >
                          <CategoryIcon className="h-3.5 w-3.5" aria-hidden="true" />
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--text-primary)]">
                          {category.name}
                        </span>
                      </button>
                    ) : (
                      <div className="flex w-full items-center rounded-full border border-[color:var(--border-soft)] bg-[var(--bg-card)] px-3 py-1.5 text-sm font-semibold text-[var(--text-secondary)]">
                        Категория не найдена
                      </div>
                    )}
                  </div>

                  {isAccountPickerOpen ? (
                    <div className="w-full rounded-2xl border border-[color:var(--border-soft)] bg-[var(--bg-card)] p-2">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)]">
                        Быстрая смена счета
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {accounts.map((item) => {
                          const active = item.id === account?.id;
                          const Icon = getIconOption(item.icon).icon;
                          const badge = shortAccountBadge(item);
                          const balance = balanceByAccountId.get(item.id);
                          return (
                            <button
                              key={item.id}
                              type="button"
                              className={`flex items-center gap-2 rounded-2xl border px-2.5 py-2 text-left transition ${
                                active
                                  ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/10"
                                  : "border-[color:var(--border-soft)] bg-[var(--bg-card)]"
                              }`}
                              onClick={() => void handleUpdateListMeta({ account_id: item.id })}
                              disabled={isMetaSaving}
                            >
                              <span
                                className="inline-flex h-8 w-8 items-center justify-center rounded-xl"
                                style={{ backgroundColor: `${item.color}22`, color: item.color }}
                              >
                                <Icon className="h-4 w-4" aria-hidden="true" />
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-xs font-semibold text-[var(--text-primary)]">
                                  {item.name}
                                </p>
                                <div className="mt-1 flex items-center justify-between gap-2">
                                  {badge ? (
                                    <span className="badge shrink-0" style={badgeStyle(item.color)}>
                                      {badge}
                                    </span>
                                  ) : (
                                    <span className="text-[11px] font-semibold text-[var(--text-secondary)]">
                                      —
                                    </span>
                                  )}
                                  <span className="ml-auto text-right text-[11px] font-semibold text-[var(--text-secondary)]">
                                    {balance
                                      ? formatAmount(balance.balance, balance.currency_code)
                                      : "—"}
                                  </span>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  {isCategoryPickerOpen ? (
                    <div className="w-full rounded-2xl border border-[color:var(--border-soft)] bg-[var(--bg-card)] p-2">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)]">
                        Быстрая смена категории
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {categories
                          .filter((item) => item.type === "expense")
                          .map((item) => {
                            const active = item.id === category?.id;
                            const Icon = getIconOption(item.icon).icon;
                            return (
                              <button
                                key={item.id}
                                type="button"
                                className={`flex items-center gap-2 rounded-2xl border px-2.5 py-2 text-left transition ${
                                  active
                                    ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/10"
                                    : "border-[color:var(--border-soft)] bg-[var(--bg-card)]"
                                }`}
                                onClick={() => void handleUpdateListMeta({ category_id: item.id })}
                                disabled={isMetaSaving}
                              >
                                <span
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-xl"
                                  style={{ backgroundColor: `${item.color}22`, color: item.color }}
                                >
                                  <Icon className="h-4 w-4" aria-hidden="true" />
                                </span>
                                <span className="truncate text-xs font-semibold text-[var(--text-primary)]">
                                  {item.name}
                                </span>
                              </button>
                            );
                          })}
                      </div>
                    </div>
                  ) : null}
                </div>
                <div className="flex items-center justify-between text-sm font-semibold text-[var(--text-primary)]">
                  <span className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border-soft)] bg-[var(--bg-card)] px-3 py-1">
                    Товаров: <span className="text-[var(--text-secondary)]">{list.items.length}</span>
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border-soft)] bg-[var(--bg-card)] px-3 py-1">
                    Итого:{" "}
                    <span className="text-[var(--text-secondary)]">
                      {formatAmount(
                        totalOverride !== null ? String(totalOverride) : list.total_amount,
                        currency?.code ?? "RUB",
                      )}
                    </span>
                  </span>
                </div>
              </section>

              <section className="mobile-card space-y-2 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)]">
                  Действия
                </p>
                <div className="flex flex-wrap gap-2">
                  {list.status === "draft" ? (
                    <Button
                      size="sm"
                      color="primary"
                      variant="flat"
                      isLoading={itemPendingKey === `confirm:${list.id}`}
                      onPress={() => void handleTransition("confirm")}
                    >
                      Подтвердить
                    </Button>
                  ) : null}
                  {list.status === "confirmed" ? (
                    <Button
                      size="sm"
                      variant="flat"
                      isLoading={itemPendingKey === `draft:${list.id}`}
                      onPress={() => void handleTransition("draft")}
                    >
                      Вернуть в черновик
                    </Button>
                  ) : null}
                  {list.status === "confirmed" ? (
                    <Button
                      size="sm"
                      color="success"
                      variant="flat"
                      isLoading={itemPendingKey === `complete:${list.id}`}
                      onPress={() => void handleTransition("complete")}
                    >
                      Завершить
                    </Button>
                  ) : null}
                  <Button size="sm" color="danger" variant="flat" onPress={handleDeleteList}>
                    Удалить список
                  </Button>
                </div>
              </section>

              <section className="space-y-2">
                {list.items.length === 0 ? (
                  <EmptyState message="Товаров пока нет." />
                ) : (
                  list.items.map((item) => (
                    <article
                      key={item.id}
                      className="flex items-center justify-between rounded-xl border border-[color:var(--border-soft)] bg-[var(--bg-card)] px-2.5 py-2"
                    >
                      <div className="min-w-0">
                        {editingItemId === item.id && editingField === "name" ? (
                          <input
                            className="w-full bg-transparent text-sm font-semibold text-[var(--text-primary)] outline-none"
                            value={editingName}
                            onChange={(event) => setEditingName(event.target.value)}
                            onBlur={() => void handleUpdateItemName(item.id)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                void handleUpdateItemName(item.id);
                              }
                              if (event.key === "Escape") {
                                event.preventDefault();
                                closeItemEditor();
                              }
                            }}
                            autoFocus
                          />
                        ) : (
                          <button
                            type="button"
                            className="flex min-w-0 items-center gap-2 text-left"
                            onClick={() =>
                              list.status === "confirmed"
                                ? void handleToggleItem(item)
                                : openItemEditor(item, "name")
                            }
                            disabled={list.status !== "draft" && list.status !== "confirmed"}
                          >
                            {list.status === "confirmed" ? (
                              <span
                                className={`inline-flex h-5 w-5 items-center justify-center rounded-md border ${
                                  item.is_checked
                                    ? "border-emerald-400 bg-emerald-500 text-white"
                                    : "border-[color:var(--border-soft)] bg-[var(--bg-card)] text-[var(--text-secondary)]"
                                }`}
                              >
                                <Check className="h-3 w-3" aria-hidden="true" />
                              </span>
                            ) : null}
                            <span
                              className={`text-sm ${
                                item.is_checked && list.status === "confirmed"
                                  ? "text-[var(--text-secondary)] line-through"
                                  : "text-[var(--text-primary)]"
                              }`}
                            >
                              {item.name}
                            </span>
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {list.status === "confirmed" ? (
                          <div className="flex items-center gap-2 rounded-xl border border-[color:var(--border-soft)] bg-[var(--bg-card)] px-2 py-1.5">
                            <span className="text-xs font-semibold text-[var(--text-secondary)]">
                              {currency?.symbol ?? "₽"}
                            </span>
                            <input
                              className="w-[82px] bg-transparent text-right text-xs font-semibold text-[var(--text-primary)] outline-none"
                              inputMode="decimal"
                              placeholder="0.00"
                              defaultValue={item.price ?? ""}
                              onFocus={(event) => event.target.select()}
                              onBlur={(event) => void handleUpdateItemPrice(item.id, event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  event.preventDefault();
                                  void handleUpdateItemPrice(item.id, (event.target as HTMLInputElement).value);
                                }
                              }}
                            />
                          </div>
                        ) : (
                          <>
                            {editingItemId === item.id && editingField === "quantity" ? (
                              <input
                                className="w-[70px] bg-transparent text-right text-xs font-semibold text-[var(--text-primary)] outline-none"
                                inputMode="numeric"
                                value={editingQuantity}
                                onChange={(event) => setEditingQuantity(event.target.value)}
                                onFocus={(event) => event.target.select()}
                                onBlur={() => void handleUpdateItemQuantity(item.id)}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter") {
                                    event.preventDefault();
                                    void handleUpdateItemQuantity(item.id);
                                  }
                                  if (event.key === "Escape") {
                                    event.preventDefault();
                                    closeItemEditor();
                                  }
                                }}
                                autoFocus
                              />
                            ) : (
                              <button
                                type="button"
                                className="w-[70px] text-right text-xs font-semibold text-[var(--text-secondary)]"
                                onClick={() => openItemEditor(item, "quantity")}
                                disabled={list.status !== "draft"}
                              >
                                {item.quantity} шт.
                              </button>
                            )}
                          </>
                        )}
                        {list.status === "draft" ? (
                          <Button
                            isIconOnly
                            size="sm"
                            variant="light"
                            color="danger"
                            isLoading={itemPendingKey === `delete:${item.id}`}
                            onPress={() => void handleDeleteItem(item.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        ) : null}
                      </div>
                    </article>
                  ))
                )}

                {list.status === "draft" ? (
                  <article className="flex items-center justify-between rounded-xl border border-dashed border-[color:var(--border-soft)] bg-[color:color-mix(in_srgb,var(--bg-card)_70%,transparent)] px-2.5 py-2">
                    <div className="min-w-0 flex-1">
                      {isCreatingItem ? (
                        <input
                          className="w-full bg-transparent text-sm font-semibold text-[var(--text-primary)] outline-none"
                          value={itemDraft.name}
                          onChange={(event) =>
                            setItemDraft((prev) => ({ ...prev, name: event.target.value }))
                          }
                          onBlur={() => void handleAddItem()}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              void handleAddItem();
                            }
                            if (event.key === "Escape") {
                              event.preventDefault();
                              closeNewItemEditor();
                            }
                          }}
                          placeholder="Добавить товар…"
                          autoFocus
                        />
                      ) : (
                        <button
                          type="button"
                          className="text-left text-sm font-semibold text-[var(--text-secondary)]"
                          onClick={openNewItemEditor}
                        >
                          + Добавить товар
                        </button>
                      )}
                    </div>
                    {isCreatingItem ? (
                      <input
                        className="w-[70px] bg-transparent text-right text-xs font-semibold text-[var(--text-primary)] outline-none"
                        inputMode="numeric"
                        value={itemDraft.quantity}
                        onChange={(event) =>
                          setItemDraft((prev) => ({ ...prev, quantity: event.target.value }))
                        }
                        onFocus={(event) => event.target.select()}
                        onBlur={() => void handleAddItem()}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            void handleAddItem();
                          }
                          if (event.key === "Escape") {
                            event.preventDefault();
                            closeNewItemEditor();
                          }
                        }}
                      />
                    ) : null}
                  </article>
                ) : null}
              </section>

              {list.status === "completed" && list.transaction_id ? (
                <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-2 text-xs text-emerald-800">
                  Список завершен, транзакция создана: #{list.transaction_id}
                </p>
              ) : null}
            </section>
          ) : null}
        </div>
      </div>
    </section>
  );
}
