"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button, Input } from "@heroui/react";
import { Check, ChevronLeft, Plus, Trash2 } from "lucide-react";
import { EmptyState, ErrorState, LoadingState } from "@/components/async-state";
import { useAuth } from "@/features/auth/auth-context";
import { ApiError } from "@/lib/api-client";
import { getIconOption } from "@/lib/icon-catalog";
import type {
  AccountResponse,
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
  price: string;
};

const DEFAULT_ITEM_DRAFT: ItemDraftState = {
  name: "",
  quantity: "1",
  price: "",
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

export default function ShoppingListDetailPage() {
  const { authenticatedRequest } = useAuth();
  const router = useRouter();
  const params = useParams();
  const listId = Number(params?.id);
  const [list, setList] = useState<ShoppingListResponse | null>(null);
  const [accounts, setAccounts] = useState<AccountResponse[]>([]);
  const [categories, setCategories] = useState<CategoryResponse[]>([]);
  const [currencies, setCurrencies] = useState<CurrencyResponse[]>([]);
  const [itemDraft, setItemDraft] = useState<ItemDraftState>(DEFAULT_ITEM_DRAFT);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [itemPendingKey, setItemPendingKey] = useState<string | null>(null);

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

  const loadData = useCallback(async () => {
    if (!Number.isFinite(listId)) {
      setErrorMessage("Некорректный идентификатор списка.");
      setIsLoading(false);
      return;
    }

    setErrorMessage(null);
    setIsRefreshing(true);

    try {
      const [listData, accountsData, categoriesData, currenciesData] = await Promise.all([
        authenticatedRequest<ShoppingListResponse>(`/api/shopping-lists/${listId}`),
        authenticatedRequest<AccountResponse[]>("/api/accounts?skip=0&limit=300"),
        authenticatedRequest<CategoryResponse[]>("/api/categories?skip=0&limit=300"),
        authenticatedRequest<CurrencyResponse[]>("/api/currencies?skip=0&limit=300"),
      ]);

      setList(listData);
      setAccounts(accountsData);
      setCategories(categoriesData);
      setCurrencies(currenciesData);
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

  const handleTransition = async (action: "confirm" | "complete") => {
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

  const handleAddItem = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
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
        price: itemDraft.price ? Number(itemDraft.price) : null,
      };
      await authenticatedRequest(`/api/shopping-lists/${list.id}/items`, { method: "POST", body: payload });
      setItemDraft(DEFAULT_ITEM_DRAFT);
      await loadData();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setItemPendingKey(null);
    }
  };

  const handleToggleItem = async (item: ShoppingItemResponse) => {
    if (!list) {
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

  const account = list ? accountById.get(list.account_id) : null;
  const category = list ? categoryById.get(list.category_id) : null;
  const currency = account ? currencyById.get(account.currency_id) : null;
  const status = list ? statusMeta(list.status) : null;
  const CategoryIcon = category ? getIconOption(category.icon).icon : null;

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
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-xl border border-[color:var(--border-soft)] bg-[var(--bg-card)] px-3 py-2 text-sm font-semibold text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]"
              onClick={() => void loadData()}
              disabled={isRefreshing}
            >
              Refresh
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-3 py-3">
          {errorMessage ? <ErrorState className="mb-3" message={errorMessage} /> : null}

          {isLoading ? <LoadingState message="Загружаем список..." /> : null}

          {!isLoading && !list ? <EmptyState message="Список не найден." /> : null}

          {!isLoading && list ? (
            <section className="space-y-3">
              <section className="mobile-card space-y-2 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold text-[var(--text-primary)]">{list.name}</p>
                    <p className="truncate text-xs text-[var(--text-secondary)]">
                      {account?.name ?? "Счет"} · {category?.name ?? "Категория"}
                    </p>
                  </div>
                  {status ? (
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${status.className}`}>
                      {status.label}
                    </span>
                  ) : null}
                </div>
                <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
                  <span>Товаров: {list.items.length}</span>
                  <span>Итого: {formatAmount(list.total_amount, currency?.code ?? "RUB")}</span>
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

              {category && CategoryIcon ? (
                <section className="mobile-card flex items-center gap-2.5 p-3">
                  <span
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl"
                    style={{ backgroundColor: `${category.color}22`, color: category.color }}
                  >
                    <CategoryIcon className="h-4.5 w-4.5" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-xs text-[var(--text-secondary)]">Категория расходов</p>
                    <p className="text-sm font-semibold text-[var(--text-primary)]">{category.name}</p>
                  </div>
                </section>
              ) : null}

              <section className="space-y-2">
                {list.items.length === 0 ? (
                  <EmptyState message="Товаров пока нет." />
                ) : (
                  list.items.map((item) => (
                    <article
                      key={item.id}
                      className="flex items-center justify-between rounded-xl border border-[color:var(--border-soft)] bg-[var(--bg-card)] px-2.5 py-2"
                    >
                      <button
                        type="button"
                        className="flex min-w-0 items-center gap-2 text-left"
                        onClick={() => void handleToggleItem(item)}
                      >
                        <span
                          className={`inline-flex h-5 w-5 items-center justify-center rounded-md border ${
                            item.is_checked
                              ? "border-emerald-400 bg-emerald-500 text-white"
                              : "border-[color:var(--border-soft)] bg-[var(--bg-card)] text-[var(--text-secondary)]"
                          }`}
                        >
                          <Check className="h-3 w-3" aria-hidden="true" />
                        </span>
                        <span
                          className={`text-sm ${
                            item.is_checked ? "line-through text-[var(--text-secondary)]" : "text-[var(--text-primary)]"
                          }`}
                        >
                          {item.name} · {item.quantity} шт.
                        </span>
                      </button>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-[var(--text-secondary)]">
                          {formatAmount(item.total_price, currency?.code ?? "RUB")}
                        </span>
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
                      </div>
                    </article>
                  ))
                )}
              </section>

              {list.status === "draft" ? (
                <section className="mobile-card space-y-3 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)]">
                        Быстрое добавление
                      </p>
                      <p className="text-xs text-[var(--text-secondary)]">
                        Введите товар и нажмите Enter — остальное опционально.
                      </p>
                    </div>
                    <div className="flex gap-1.5">
                      {["Молоко", "Хлеб", "Яйца"].map((quick) => (
                        <button
                          key={quick}
                          type="button"
                          className="rounded-full border border-[color:var(--border-soft)] bg-[var(--bg-card)] px-2.5 py-1 text-[11px] font-semibold text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]"
                          onClick={() => setItemDraft((prev) => ({ ...prev, name: quick }))}
                        >
                          {quick}
                        </button>
                      ))}
                    </div>
                  </div>

                  <form className="space-y-3" onSubmit={handleAddItem}>
                    <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[var(--bg-card)] p-3 transition focus-within:shadow-[0_0_0_3px_var(--ring-primary)]">
                      <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)]">
                        Товар
                      </label>
                      <input
                        className="mt-2 w-full bg-transparent text-lg font-semibold text-[var(--text-primary)] outline-none"
                        placeholder="Например: сыр, вода, бананы…"
                        value={itemDraft.name}
                        onChange={(event) => setItemDraft((prev) => ({ ...prev, name: event.target.value }))}
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                      <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[var(--bg-card)] px-3 py-2.5">
                        <p className="text-xs font-semibold text-[var(--text-secondary)]">Кол-во</p>
                        <div className="mt-2 flex items-center gap-2">
                          <button
                            type="button"
                            className="h-8 w-8 rounded-xl border border-[color:var(--border-soft)] text-sm font-semibold text-[var(--text-secondary)]"
                            onClick={() =>
                              setItemDraft((prev) => ({
                                ...prev,
                                quantity: String(Math.max(1, (Number(prev.quantity) || 1) - 1)),
                              }))
                            }
                          >
                            -
                          </button>
                          <input
                            className="w-full bg-transparent text-center text-base font-semibold text-[var(--text-primary)] outline-none"
                            inputMode="numeric"
                            value={itemDraft.quantity}
                            onChange={(event) =>
                              setItemDraft((prev) => ({ ...prev, quantity: event.target.value }))
                            }
                          />
                          <button
                            type="button"
                            className="h-8 w-8 rounded-xl border border-[color:var(--border-soft)] text-sm font-semibold text-[var(--text-secondary)]"
                            onClick={() =>
                              setItemDraft((prev) => ({
                                ...prev,
                                quantity: String((Number(prev.quantity) || 1) + 1),
                              }))
                            }
                          >
                            +
                          </button>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[var(--bg-card)] px-3 py-2.5">
                        <p className="text-xs font-semibold text-[var(--text-secondary)]">Цена</p>
                        <div className="mt-2 flex items-center gap-2">
                          <span className="text-sm font-semibold text-[var(--text-secondary)]">
                            {currency?.symbol ?? "₽"}
                          </span>
                          <input
                            className="w-full bg-transparent text-base font-semibold text-[var(--text-primary)] outline-none"
                            inputMode="decimal"
                            placeholder="0.00"
                            value={itemDraft.price}
                            onChange={(event) =>
                              setItemDraft((prev) => ({ ...prev, price: event.target.value }))
                            }
                          />
                        </div>
                      </div>

                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap gap-1.5">
                        {[1, 2, 3, 5].map((qty) => (
                          <button
                            key={qty}
                            type="button"
                            className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
                              String(qty) === itemDraft.quantity
                                ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]"
                                : "border-[color:var(--border-soft)] bg-[var(--bg-card)] text-[var(--text-secondary)]"
                            }`}
                            onClick={() => setItemDraft((prev) => ({ ...prev, quantity: String(qty) }))}
                          >
                            {qty} шт.
                          </button>
                        ))}
                      </div>
                      <Button
                        type="submit"
                        color="primary"
                        size="sm"
                        isLoading={itemPendingKey === `add:${list.id}`}
                        startContent={<Plus className="h-4 w-4" />}
                      >
                        Добавить
                      </Button>
                    </div>
                  </form>
                </section>
              ) : null}

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
