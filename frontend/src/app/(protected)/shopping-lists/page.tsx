"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Accordion, AccordionItem, Button } from "@heroui/react";
import { ChevronLeft, Plus, Trash2 } from "lucide-react";
import { EmptyState, ErrorState, LoadingState } from "@/components/async-state";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useAuth } from "@/features/auth/auth-context";
import { ApiError } from "@/lib/api-client";
import type {
  AccountResponse,
  CategoryResponse,
  CurrencyResponse,
  ShoppingListCreate,
  ShoppingListResponse,
  ShoppingListStatus,
} from "@/lib/types";

type StatusFilter = ShoppingListStatus | "all";


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
      className:
        "border-[color:color-mix(in_srgb,#60a5fa_55%,transparent)] bg-[color:color-mix(in_srgb,#60a5fa_18%,transparent)] text-[color:color-mix(in_srgb,#1d4ed8_85%,var(--text-primary))]",
    };
  }

  if (status === "completed") {
    return {
      label: "Завершен",
      className:
        "border-[color:color-mix(in_srgb,#34d399_55%,transparent)] bg-[color:color-mix(in_srgb,#34d399_18%,transparent)] text-[color:color-mix(in_srgb,#047857_85%,var(--text-primary))]",
    };
  }

  return {
    label: "Черновик",
    className:
      "border-[color:color-mix(in_srgb,#f59e0b_55%,transparent)] bg-[color:color-mix(in_srgb,#f59e0b_18%,transparent)] text-[color:color-mix(in_srgb,#b45309_85%,var(--text-primary))]",
  };
}

export default function ShoppingListsPage() {
  const { authenticatedRequest } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [lists, setLists] = useState<ShoppingListResponse[]>([]);
  const [accounts, setAccounts] = useState<AccountResponse[]>([]);
  const [categories, setCategories] = useState<CategoryResponse[]>([]);
  const [currencies, setCurrencies] = useState<CurrencyResponse[]>([]);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

  const createQuickList = async () => {
    const fallbackAccount = accounts[0];
    const fallbackCategory = expenseCategories[0];
    if (!fallbackAccount || !fallbackCategory) {
      setErrorMessage("Добавьте счет и категорию перед созданием списка.");
      return;
    }
    setErrorMessage(null);
    try {
      const payload: ShoppingListCreate = {
        name: "Новый список",
        account_id: fallbackAccount.id,
        category_id: fallbackCategory.id,
        items: [],
      };
      const created = await authenticatedRequest<ShoppingListResponse>("/api/shopping-lists", {
        method: "POST",
        body: payload,
      });
      router.push(`/shopping-lists/${created.id}`);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
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

  const handleTransition = async (
    listId: number,
    action: "confirm" | "complete" | "draft",
  ) => {
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
              onClick={() => void createQuickList()}
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
                            <Link
                              href={`/shopping-lists/${list.id}`}
                              className="inline-flex items-center gap-2 rounded-xl border border-[color:var(--border-soft)] bg-[var(--bg-card)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]"
                            >
                              Открыть
                            </Link>
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
                                variant="flat"
                                onPress={() => void handleTransition(list.id, "draft")}
                              >
                                Вернуть в черновик
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

        {errorMessage ? <ErrorState message={errorMessage} /> : null}
      </div>
    </section>
  );
}
