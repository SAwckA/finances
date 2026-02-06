"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Minus, Pencil, Plus, Trash2 } from "lucide-react";
import { EmptyState, ErrorState, LoadingState } from "@/components/async-state";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { TransactionEditorHeader } from "@/components/transactions/transaction-editor-header";
import { ApiError } from "@/lib/api-client";
import { getIconOption, ICON_OPTIONS } from "@/lib/icon-catalog";
import { useAuth } from "@/features/auth/auth-context";
import type { CategoryCreate, CategoryResponse, CategoryType, CategoryUpdate } from "@/lib/types";

type CategoryFilter = CategoryType | "all";

type CategoryFormState = {
  name: string;
  color: string;
  icon: string;
  type: CategoryType;
};

const FORM_ID = "category-editor-form";

const ICON_TILE_COLORS = [
  "#F7ECD9",
  "#E7EEFF",
  "#DDF3E5",
  "#F9E4E4",
  "#EDE5FB",
  "#F8E5F2",
  "#F8F0D8",
  "#DCF2E8",
  "#DFF3FB",
  "#FAF0CA",
  "#DCD9FB",
  "#D9E8F7",
  "#EDE9FA",
  "#F8DDE4",
  "#E7F4CF",
  "#FBEEDC",
  "#DDF3EE",
  "#E8ECF3",
];

const CATEGORY_COLOR_OPTIONS = [
  "#E0534A",
  "#F28C38",
  "#E0B43F",
  "#1FA66A",
  "#2AA198",
  "#4F7EF6",
  "#5B62DC",
  "#8E5BE8",
  "#D65497",
  "#64748B",
];

const TYPE_DEFAULT_COLOR: Record<CategoryType, string> = {
  expense: "#E0534A",
  income: "#1FA66A",
};

const DEFAULT_FORM: CategoryFormState = {
  name: "",
  color: TYPE_DEFAULT_COLOR.expense,
  icon: "utensils",
  type: "expense",
};

function toSoftBackground(hexColor: string, alpha: number): string {
  const hex = hexColor.replace("#", "");
  const normalized = hex.length === 3 ? hex.split("").map((char) => `${char}${char}`).join("") : hex;
  if (normalized.length !== 6) {
    return "rgba(148, 163, 184, 0.08)";
  }

  const value = Number.parseInt(normalized, 16);
  if (Number.isNaN(value)) {
    return "rgba(148, 163, 184, 0.08)";
  }

  const red = (value >> 16) & 255;
  const green = (value >> 8) & 255;
  const blue = value & 255;
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
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

export default function CategoriesPage() {
  const { authenticatedRequest } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [categories, setCategories] = useState<CategoryResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [form, setForm] = useState<CategoryFormState>(DEFAULT_FORM);
  const [isFormLoading, setIsFormLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const createParam = searchParams.get("create");
  const editParam = searchParams.get("edit");
  const filterParam = searchParams.get("filter");
  const activeFilter: CategoryFilter =
    filterParam === "expense" || filterParam === "income" ? filterParam : "all";
  const isCreateMode = createParam === "1" || createParam === "true";
  const parsedEditId = editParam ? Number(editParam) : null;
  const isEditMode = Number.isFinite(parsedEditId ?? Number.NaN);
  const editingId = isEditMode ? (parsedEditId as number) : null;
  const isModalOpen = isCreateMode || isEditMode;

  const filteredCategories = useMemo(() => {
    if (activeFilter === "all") {
      return categories;
    }
    return categories.filter((category) => category.type === activeFilter);
  }, [activeFilter, categories]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const query = activeFilter === "all" ? "" : `?category_type=${activeFilter}`;
      const data = await authenticatedRequest<CategoryResponse[]>(`/api/categories${query}`);
      setCategories(data);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, [activeFilter, authenticatedRequest]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!isModalOpen) {
      return;
    }

    if (isCreateMode) {
      setForm(DEFAULT_FORM);
      setFormError(null);
      setIsFormLoading(false);
      return;
    }

    if (!editingId) {
      return;
    }

    const loadCategory = async () => {
      setIsFormLoading(true);
      setFormError(null);
      try {
        const category = await authenticatedRequest<CategoryResponse>(`/api/categories/${editingId}`);
        setForm({
          name: category.name,
          color: category.color,
          icon: category.icon,
          type: category.type,
        });
      } catch (error) {
        setFormError(getErrorMessage(error));
      } finally {
        setIsFormLoading(false);
      }
    };

    void loadCategory();
  }, [authenticatedRequest, editingId, isCreateMode, isModalOpen]);

  const buildHref = useCallback(
    (name: string, value: string | null) => {
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

  const closeModal = () => {
    router.back();
  };

  const handleDelete = async (categoryId: number) => {
    const confirmed = window.confirm("Удалить категорию?");
    if (!confirmed) {
      return;
    }

    setErrorMessage(null);
    try {
      await authenticatedRequest(`/api/categories/${categoryId}`, { method: "DELETE" });
      await loadData();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.name.trim() || !form.icon || !form.color) {
      setFormError("Заполните обязательные поля.");
      return;
    }

    setIsSaving(true);
    setFormError(null);

    const payload: CategoryCreate | CategoryUpdate = {
      name: form.name.trim(),
      color: form.color,
      icon: form.icon,
      type: form.type,
    };

    try {
      if (editingId) {
        await authenticatedRequest(`/api/categories/${editingId}`, {
          method: "PATCH",
          body: payload,
        });
      } else {
        await authenticatedRequest("/api/categories", { method: "POST", body: payload });
      }
      await loadData();
      closeModal();
    } catch (error) {
      setFormError(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  const formIconOptions = useMemo(() => ICON_OPTIONS.slice(4, 22), []);
  const PreviewIcon = getIconOption(form.icon).icon;

  const typeAccent = form.type === "expense" ? "#E0534A" : "#1FA66A";

  return (
    <section className="space-y-3">
      {isModalOpen ? (
        <section className="fixed inset-0 z-50 overscroll-contain bg-[var(--bg-app)]">
          <div className="mx-auto flex h-full w-full max-w-[430px] flex-col">
            <TransactionEditorHeader
              title={editingId ? "Edit Category" : "New Category"}
              onBack={closeModal}
              formId={FORM_ID}
              isSaving={isSaving}
            />
            <div className="flex-1 overflow-y-auto px-3 py-3">
              <form
                id={FORM_ID}
                className="mobile-card space-y-3 p-3"
                onSubmit={handleSubmit}
              >
                {isFormLoading ? <LoadingState message="Загружаем категорию…" /> : null}

                {!isFormLoading ? (
                  <>
                    <section>
                      <p className="mb-1.5 text-sm font-semibold text-[var(--text-secondary)]">Category Type</p>
                      <SegmentedControl
                        options={[
                          { key: "expense", label: "Expense" },
                          { key: "income", label: "Income" },
                        ]}
                        value={form.type}
                        onChange={(nextType) =>
                          setForm((prev) => ({
                            ...prev,
                            type: nextType,
                            color: TYPE_DEFAULT_COLOR[nextType],
                          }))
                        }
                      />
                    </section>

                    <label className="block text-sm text-[var(--text-secondary)]">
                      Category Name
                      <input
                        className="mt-1 block w-full rounded-xl border border-[color:var(--border-soft)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none transition focus-visible:ring-2 focus-visible:ring-[var(--ring-primary)]"
                        value={form.name}
                        name="categoryName"
                        autoComplete="off"
                        onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                        placeholder="Enter category name…"
                        required
                      />
                    </label>

                    <section>
                      <p className="mb-1.5 text-sm font-semibold text-[var(--text-secondary)]">Choose Icon</p>
                      <div className="grid grid-cols-6 gap-2">
                        {formIconOptions.map((option, index) => {
                          const Icon = option.icon;
                          const active = option.value === form.icon;
                          const tileColor = ICON_TILE_COLORS[index % ICON_TILE_COLORS.length];
                          return (
                            <button
                              key={option.value}
                              type="button"
                              className={`rounded-xl border p-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring-primary)] ${
                                active
                                  ? "border-[var(--accent-primary)] shadow-[0_0_0_2px_var(--ring-primary)]"
                                  : "border-[color:var(--border-soft)]"
                              }`}
                              style={{
                                backgroundColor: "color-mix(in_srgb, var(--bg-card) 65%, transparent)",
                                boxShadow: `inset 0 0 0 999px ${tileColor}30`,
                              }}
                              onClick={() => setForm((prev) => ({ ...prev, icon: option.value }))}
                              aria-label={option.label}
                            >
                              <Icon
                                className="mx-auto h-4.5 w-4.5 text-[var(--text-primary)]"
                                aria-hidden="true"
                              />
                            </button>
                          );
                        })}
                      </div>
                    </section>

                    <section>
                      <p className="mb-1.5 text-sm font-semibold text-[var(--text-secondary)]">Choose Color</p>
                      <div className="grid grid-cols-5 gap-2">
                        {CATEGORY_COLOR_OPTIONS.map((color) => {
                          const active = color === form.color;
                          return (
                            <button
                              key={color}
                              type="button"
                              className={`h-10 rounded-xl border-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring-primary)] ${
                                active ? "border-[var(--text-primary)]" : "border-transparent"
                              }`}
                              style={{ backgroundColor: color }}
                              onClick={() => setForm((prev) => ({ ...prev, color }))}
                              aria-label={color}
                            />
                          );
                        })}
                      </div>
                    </section>

                    <section className="rounded-2xl border border-[color:var(--border-soft)] bg-[var(--bg-card)] p-3">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-secondary)]">
                        Preview
                      </p>
                      <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[var(--bg-app)] px-3 py-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-2.5">
                            <span
                              className="inline-flex h-10 w-10 items-center justify-center rounded-xl"
                              style={{ backgroundColor: `${form.color}22`, color: form.color }}
                            >
                              <PreviewIcon className="h-4.5 w-4.5" aria-hidden="true" />
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
                                {form.name.trim() || "Custom Category"}
                              </p>
                              <p className="truncate text-xs text-[var(--text-secondary)]">New category</p>
                            </div>
                          </div>
                          <span
                            className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-semibold"
                            style={{
                              backgroundColor: `${typeAccent}22`,
                              borderColor: `${typeAccent}55`,
                              color: typeAccent,
                            }}
                          >
                            {form.type === "expense" ? (
                              <Minus className="h-3.5 w-3.5" aria-hidden="true" />
                            ) : (
                              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                            )}
                            {form.type}
                          </span>
                        </div>
                      </div>
                    </section>

                    {formError ? <ErrorState message={formError} /> : null}

                    {editingId ? (
                      <button
                        type="button"
                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-rose-400/40 bg-rose-500/10 px-3 py-2.5 text-sm font-semibold text-rose-600 transition hover:bg-rose-500/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
                        onClick={() => void handleDelete(editingId)}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                        Delete Category
                      </button>
                    ) : null}
                  </>
                ) : null}
              </form>
            </div>
          </div>
        </section>
      ) : null}

      <section className="mobile-card p-3">
        <div className="flex items-center justify-between">
          <h1 className="section-title text-[1.35rem] text-[var(--text-primary)]">Categories</h1>
          <Link
            href={buildHref("create", "1")}
            scroll={false}
            className="rounded-xl bg-[var(--accent-primary)] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent-primary-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring-primary)]"
          >
            New
          </Link>
        </div>
      </section>

      <section className="mobile-card p-3">
        <p className="mb-1.5 text-sm font-semibold text-[var(--text-secondary)]">Filter</p>
        <SegmentedControl
          options={[
            { key: "all", label: "All" },
            { key: "expense", label: "Expense" },
            { key: "income", label: "Income" },
          ]}
          value={activeFilter}
          onChange={(nextFilter) =>
            router.replace(buildHref("filter", nextFilter === "all" ? null : nextFilter), { scroll: false })
          }
        />
      </section>

      {errorMessage ? <ErrorState message={errorMessage} /> : null}

      <section className="space-y-2">
        {isLoading ? <LoadingState message="Загружаем категории…" /> : null}
        {!isLoading && filteredCategories.length === 0 ? <EmptyState message="Категории не найдены." /> : null}

        {!isLoading
          ? filteredCategories.map((category) => {
              const iconOption = getIconOption(category.icon);
              const CategoryIcon = iconOption.icon;
              return (
                <article
                  key={category.id}
                  className="mobile-card p-3"
                  style={{ backgroundColor: toSoftBackground(category.color, 0.1) }}
                >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span
                      className="inline-flex h-10 w-10 items-center justify-center rounded-xl"
                      style={{ backgroundColor: `${category.color}33`, color: category.color }}
                    >
                      <CategoryIcon className="h-4.5 w-4.5" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{category.name}</p>
                      <span
                        className="mt-1 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold"
                        style={{
                          backgroundColor: `${category.type === "expense" ? "#E0534A" : "#1FA66A"}22`,
                          borderColor: `${category.type === "expense" ? "#E0534A" : "#1FA66A"}55`,
                          color: category.type === "expense" ? "#E0534A" : "#1FA66A",
                        }}
                      >
                        {category.type === "expense" ? (
                          <Minus className="h-3.5 w-3.5" aria-hidden="true" />
                        ) : (
                          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                        )}
                        {category.type}
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <div className="flex gap-2">
                      <Link
                        href={buildHref("edit", String(category.id))}
                        scroll={false}
                        className="surface-hover inline-flex items-center gap-1 rounded-lg border border-[color:var(--border-soft)] bg-[var(--bg-card)] px-2.5 py-1.5 text-xs font-semibold text-[var(--text-secondary)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring-primary)]"
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                        Edit
                      </Link>
                    </div>
                  </div>
                </div>
              </article>
            );
            })
          : null}
      </section>
    </section>
  );
}
