"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, Plus } from "lucide-react";
import { EmptyState, ErrorState, LoadingState } from "@/components/async-state";
import { SegmentedControl } from "@/components/ui/segmented-control";
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
} from "@/lib/types";

type StatusFilter = ShoppingListStatus | "all" | "active";


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

function computeTotal(items: ShoppingListResponse["items"]): number {
  return items.reduce((sum, item) => {
    if (item.total_price === null || item.total_price === undefined) {
      return sum;
    }
    return sum + Number(item.total_price);
  }, 0);
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
  const [filter, setFilter] = useState<StatusFilter>("active");
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
      const statusQuery =
        filter === "all" || filter === "active" ? "" : `?status=${filter}`;
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

        <div className="flex-1 overflow-y-auto px-3 py-3 pb-24">
          <section className="space-y-3">
            <SegmentedControl
              options={[
                { key: "active", label: "Active" },
                { key: "completed", label: "Completed" },
                { key: "all", label: "All" },
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
              {!isLoading && filter === "active" && lists.length > 0 ? (
                lists.some(
                  (list) => list.status === "draft" || list.status === "confirmed",
                ) ? null : (
                  <EmptyState message="Списков нет." />
                )
              ) : null}

              {!isLoading && lists.length > 0 ? (
                <div className="space-y-2">
                  {(filter === "active"
                    ? lists.filter(
                        (list) =>
                          list.status === "draft" || list.status === "confirmed",
                      )
                    : lists
                  ).map((list) => {
                    const status = statusMeta(list.status);
                    const account = accountById.get(list.account_id);
                    const currency = account ? currencyById.get(account.currency_id) : null;
                    const category = categoryById.get(list.category_id);
                    const CategoryIcon = category ? getIconOption(category.icon).icon : null;
                    const AccountIcon = account ? getIconOption(account.icon).icon : null;
                    const totalOverride =
                      list.total_amount === null || list.total_amount === undefined
                        ? computeTotal(list.items)
                        : null;

                    return (
                      <Link
                        key={list.id}
                        href={`/shopping-lists/${list.id}`}
                        className="mobile-card block space-y-3 p-3 transition hover:border-[color:var(--accent-primary)] hover:shadow-[0_0_0_1px_var(--accent-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring-primary)]"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-base font-semibold text-[var(--text-primary)]">
                              {list.name}
                            </p>
                          </div>
                          <span
                            className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${status.className}`}
                          >
                            {status.label}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="flex min-w-0 items-center gap-2 rounded-full border border-[color:var(--border-soft)] bg-[color:color-mix(in_srgb,var(--bg-card)_85%,transparent)] px-3 py-1.5">
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
                              <span className="badge shrink-0">{shortAccountBadge(account)}</span>
                            ) : null}
                          </div>
                          <div className="flex min-w-0 items-center gap-2 rounded-full border border-[color:var(--border-soft)] bg-[color:color-mix(in_srgb,var(--bg-card)_85%,transparent)] px-3 py-1.5">
                            <span
                              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                              style={{
                                backgroundColor: category ? `${category.color}22` : "var(--surface-hover)",
                                color: category?.color ?? "var(--text-secondary)",
                              }}
                            >
                              {CategoryIcon ? (
                                <CategoryIcon className="h-3.5 w-3.5" aria-hidden="true" />
                              ) : (
                                <span className="text-xs font-semibold">#</span>
                              )}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
                                {category?.name ?? "Категория"}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-sm font-semibold text-[var(--text-primary)]">
                          <span className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border-soft)] bg-[color:color-mix(in_srgb,var(--bg-card)_85%,transparent)] px-3 py-1">
                            Товаров:{" "}
                            <span className="text-[var(--text-secondary)]">{list.items.length}</span>
                          </span>
                          <span className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border-soft)] bg-[color:color-mix(in_srgb,var(--bg-card)_85%,transparent)] px-3 py-1">
                            Итого:{" "}
                            <span className="text-[var(--text-secondary)]">
                              {formatAmount(
                                totalOverride !== null ? String(totalOverride) : list.total_amount,
                                currency?.code ?? "RUB",
                              )}
                            </span>
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              ) : null}
            </section>
          </section>
        </div>

      </div>
    </section>
  );
}
