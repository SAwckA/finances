"use client";

import Link from "next/link";
import { type CSSProperties, FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Check, Minus, Pencil, Plus, Trash2 } from "lucide-react";
import { EmptyState, ErrorState, LoadingState } from "@/components/async-state";
import { UiSegmentedControl } from "@/components/ui/ui-segmented-control";
import { UiTopBar } from "@/components/ui/ui-top-bar";
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

const FORM_FIELD_SHELL_CLASS =
  "mt-1 flex items-center gap-2 rounded-2xl bg-gradient-to-br from-content2/82 to-content1 px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_10px_22px_rgba(2,6,23,0.18)] transition focus-within:shadow-[0_0_0_2px_var(--ring-primary),inset_0_1px_0_rgba(255,255,255,0.1),0_12px_24px_rgba(2,6,23,0.24)]";

const FORM_FIELD_INPUT_CLASS =
  "w-full bg-transparent py-0.5 text-base font-semibold text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] outline-none";

const TYPE_TONE: Record<CategoryType, string> = {
  expense: "#E0534A",
  income: "#1FA66A",
};

function selectedGradientStyle(color: string): CSSProperties {
  return {
    backgroundImage: `radial-gradient(circle at 10% 0%, ${color}3f 0%, transparent 48%), linear-gradient(135deg, ${color}30 0%, ${color}16 52%, transparent 100%), linear-gradient(135deg, color-mix(in srgb, var(--heroui-content2) 80%, transparent) 0%, color-mix(in srgb, var(--heroui-content1) 100%, transparent) 100%)`,
    boxShadow: `0 0 0 2px ${color}66, 0 12px 24px rgba(2, 6, 23, 0.24)`,
  };
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
  const isEditMode = Number.isInteger(parsedEditId) && (parsedEditId as number) > 0;
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

  const closeModal = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("create");
    params.delete("edit");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  const openCreateModal = useCallback(() => {
    router.push(buildHref("create", "1"), { scroll: false });
  }, [buildHref, router]);

  const openEditModal = useCallback(
    (categoryId: number) => {
      router.push(buildHref("edit", String(categoryId)), { scroll: false });
    },
    [buildHref, router],
  );

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

  if (isModalOpen) {
    return (
      <section className="fixed inset-0 z-50 overscroll-contain bg-[var(--bg-app)]">
        <div className="mx-auto flex h-full w-full max-w-[430px] flex-col">
          <UiTopBar
            title={editingId ? "Редактирование категории" : "Новая категория"}
            onBack={closeModal}
            formId={FORM_ID}
            isSaving={isSaving}
            className="border-b-0"
          />
          <div className="flex-1 overflow-y-auto px-3 py-3">
            <form
              id={FORM_ID}
              className="app-panel space-y-3 p-3"
              onSubmit={handleSubmit}
            >
              {isFormLoading ? <LoadingState message="Загружаем категорию…" /> : null}

              {!isFormLoading ? (
                <>
                  <section>
                    <p className="mb-1.5 text-sm font-semibold text-[var(--text-secondary)]">Тип категории</p>
                    <div className="grid grid-cols-2 gap-2">
                      {([
                        { key: "expense", label: "Расход" },
                        { key: "income", label: "Доход" },
                      ] as const).map((option) => {
                        const active = form.type === option.key;
                        const tone = TYPE_TONE[option.key];
                        return (
                          <button
                            key={option.key}
                            type="button"
                            className={`interactive-hover rounded-2xl px-3 py-2.5 text-sm font-semibold transition ${
                              active
                                ? "text-[var(--text-primary)]"
                                : "bg-gradient-to-br from-content2/80 to-content1 text-[var(--text-secondary)] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_10px_22px_rgba(2,6,23,0.18)]"
                            }`}
                            style={active ? selectedGradientStyle(tone) : undefined}
                            onClick={() =>
                              setForm((prev) => ({
                                ...prev,
                                type: option.key,
                                color: TYPE_DEFAULT_COLOR[option.key],
                              }))
                            }
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                  </section>

                  <label className="block text-sm text-[var(--text-secondary)]">
                    Название категории
                    <div className={FORM_FIELD_SHELL_CLASS}>
                      <input
                        className={FORM_FIELD_INPUT_CLASS}
                        value={form.name}
                        name="categoryName"
                        autoComplete="off"
                        onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                        placeholder="Введите название категории…"
                        required
                      />
                    </div>
                  </label>

                  <section>
                    <p className="mb-1.5 text-sm font-semibold text-[var(--text-secondary)]">Выберите иконку</p>
                    <div className="grid grid-cols-6 gap-2">
                      {formIconOptions.map((option, index) => {
                        const Icon = option.icon;
                        const active = option.value === form.icon;
                        const tileColor = ICON_TILE_COLORS[index % ICON_TILE_COLORS.length];
                        return (
                          <button
                            key={option.value}
                            type="button"
                            className={`interactive-hover relative rounded-2xl p-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring-primary)] ${
                              active ? "text-[var(--text-primary)] scale-[1.02]" : "text-[var(--text-secondary)]"
                            }`}
                            style={{
                              ...(active
                                ? selectedGradientStyle(form.color)
                                : {
                                    backgroundImage: `linear-gradient(135deg, color-mix(in srgb, ${tileColor} 22%, var(--heroui-content2)) 0%, color-mix(in srgb, ${tileColor} 12%, var(--heroui-content1)) 100%)`,
                                    boxShadow:
                                      "inset 0 1px 0 rgba(255,255,255,0.08), 0 10px 22px rgba(2,6,23,0.18)",
                                  }),
                            }}
                            onClick={() => setForm((prev) => ({ ...prev, icon: option.value }))}
                            aria-label={option.label}
                          >
                            {active ? (
                              <span className="absolute right-1.5 top-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-black/20 text-[var(--text-primary)]">
                                <Check className="h-3 w-3" aria-hidden="true" />
                              </span>
                            ) : null}
                            <span
                              className="mx-auto inline-flex h-8 w-8 items-center justify-center rounded-xl"
                              style={{
                                backgroundColor: active ? `${form.color}2a` : `${tileColor}30`,
                                color: active ? form.color : "var(--text-primary)",
                              }}
                            >
                              <Icon
                                className="h-4.5 w-4.5"
                                aria-hidden="true"
                              />
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </section>

                  <section>
                    <p className="mb-1.5 text-sm font-semibold text-[var(--text-secondary)]">Выберите цвет</p>
                    <div className="grid grid-cols-5 gap-2">
                      {CATEGORY_COLOR_OPTIONS.map((color) => {
                        const active = color === form.color;
                        return (
                          <button
                            key={color}
                            type="button"
                            className={`interactive-hover relative h-11 rounded-2xl transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring-primary)] ${
                              active ? "scale-[1.03]" : ""
                            }`}
                            style={{
                              backgroundImage: `linear-gradient(135deg, ${color} 0%, ${color}dd 100%)`,
                              boxShadow: active
                                ? `0 0 0 2px ${color}88, 0 12px 24px rgba(2, 6, 23, 0.24)`
                                : "inset 0 1px 0 rgba(255,255,255,0.2), 0 8px 16px rgba(2, 6, 23, 0.2)",
                            }}
                            onClick={() => setForm((prev) => ({ ...prev, color }))}
                            aria-label={color}
                          >
                            {active ? (
                              <span className="absolute right-1.5 top-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-black/20 text-[var(--text-primary)]">
                                <Check className="h-3 w-3" aria-hidden="true" />
                              </span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  </section>

                  <section className="rounded-2xl bg-gradient-to-br from-content2/82 to-content1 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_10px_20px_rgba(2,6,23,0.18)]">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-secondary)]">
                      Превью
                    </p>
                    <div className="rounded-2xl bg-gradient-to-br from-content2/75 to-content1 px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
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
                              {form.name.trim() || "Новая категория"}
                            </p>
                            <p className="truncate text-xs text-[var(--text-secondary)]">Категория</p>
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
                          {form.type === "expense" ? "Расход" : "Доход"}
                        </span>
                      </div>
                    </div>
                  </section>

                  {formError ? <ErrorState message={formError} /> : null}

                  {editingId ? (
                    <button
                      type="button"
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-danger-400/40 bg-danger-500/10 px-3 py-2.5 text-sm font-semibold text-danger-600 transition hover:bg-danger-500/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger-300"
                      onClick={() => void handleDelete(editingId)}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                      Удалить категорию
                    </button>
                  ) : null}
                </>
              ) : null}
            </form>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <section className="app-panel p-3">
        <div className="flex items-center justify-between">
          <h1 className="section-title text-[1.35rem] text-[var(--text-primary)]">Категории</h1>
          <Link
            href="#"
            className="rounded-xl bg-[var(--accent-primary)] px-3 py-2 text-sm font-semibold text-[var(--text-primary)] transition hover:bg-[var(--accent-primary-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring-primary)]"
            onClick={(event) => {
              event.preventDefault();
              void openCreateModal();
            }}
          >
            Добавить
          </Link>
        </div>
      </section>

      <section className="app-panel p-3">
        <p className="mb-1.5 text-sm font-semibold text-[var(--text-secondary)]">Фильтр</p>
        <UiSegmentedControl
          options={[
            { key: "all", label: "Все" },
            { key: "expense", label: "Расходы" },
            { key: "income", label: "Доходы" },
          ]}
          value={activeFilter}
          onChange={(nextFilter) =>
            router.replace(buildHref("filter", nextFilter === "all" ? null : nextFilter), { scroll: false })
          }
        />
      </section>

      {errorMessage ? <ErrorState message={errorMessage} /> : null}

      <section className="motion-stagger space-y-2">
        {isLoading ? <LoadingState message="Загружаем категории…" /> : null}
        {!isLoading && filteredCategories.length === 0 ? <EmptyState message="Категории не найдены." /> : null}

        {!isLoading
          ? filteredCategories.map((category) => {
              const iconOption = getIconOption(category.icon);
              const CategoryIcon = iconOption.icon;
              return (
                <article
                  key={category.id}
                  className="app-panel interactive-hover p-3"
                  style={{
                    backgroundImage: `radial-gradient(circle at 10% 0%, ${category.color}1f 0%, transparent 42%), linear-gradient(135deg, color-mix(in srgb, var(--bg-card) 96%, transparent) 0%, color-mix(in srgb, var(--bg-card) 100%, transparent) 100%)`,
                  }}
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
                          className="mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
                          style={{
                            backgroundColor: `${category.type === "expense" ? "#E0534A" : "#1FA66A"}22`,
                            color: category.type === "expense" ? "#E0534A" : "#1FA66A",
                          }}
                        >
                        {category.type === "expense" ? (
                          <Minus className="h-3.5 w-3.5" aria-hidden="true" />
                        ) : (
                          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                        )}
                        {category.type === "expense" ? "Расход" : "Доход"}
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <div className="flex gap-2">
                      <Link
                        href="#"
                        className="surface-hover inline-flex items-center gap-1 rounded-lg bg-gradient-to-br from-content2/82 to-content1 px-2.5 py-1.5 text-xs font-semibold text-[var(--text-secondary)] transition shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_6px_12px_rgba(2,6,23,0.14)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring-primary)]"
                        onClick={(event) => {
                          event.preventDefault();
                          void openEditModal(category.id);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                        Изменить
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
