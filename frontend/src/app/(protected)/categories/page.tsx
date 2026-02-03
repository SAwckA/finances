"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Minus, Pencil, Plus, Trash2 } from "lucide-react";
import { EmptyState, LoadingState } from "@/components/async-state";
import { SegmentedControl } from "@/components/ui/segmented-control";
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
  const [categories, setCategories] = useState<CategoryResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [filter, setFilter] = useState<CategoryFilter>("all");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<CategoryFormState>(DEFAULT_FORM);

  const filteredCategories = useMemo(() => {
    if (filter === "all") {
      return categories;
    }
    return categories.filter((category) => category.type === filter);
  }, [categories, filter]);

  const formIconOptions = useMemo(() => ICON_OPTIONS.slice(4, 22), []);
  const PreviewIcon = getIconOption(form.icon).icon;

  const resetForm = useCallback(() => {
    setEditingId(null);
    setForm(DEFAULT_FORM);
  }, []);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const query = filter === "all" ? "" : `?category_type=${filter}`;
      const data = await authenticatedRequest<CategoryResponse[]>(`/api/categories${query}`);
      setCategories(data);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, [authenticatedRequest, filter]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!form.name.trim() || !form.icon || !form.color) {
      setErrorMessage("Заполните обязательные поля.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

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

      resetForm();
      await loadData();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (category: CategoryResponse) => {
    setEditingId(category.id);
    setForm({
      name: category.name,
      color: category.color,
      icon: category.icon,
      type: category.type,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (categoryId: number) => {
    const confirmed = window.confirm("Удалить категорию?");
    if (!confirmed) {
      return;
    }

    setErrorMessage(null);

    try {
      await authenticatedRequest(`/api/categories/${categoryId}`, { method: "DELETE" });
      if (editingId === categoryId) {
        resetForm();
      }
      await loadData();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  };

  return (
    <section className="space-y-3">
      <form className="mobile-card space-y-3 p-3" onSubmit={handleSubmit}>
        <div className="flex items-center justify-between">
          <h1 className="section-title text-[1.35rem]">{editingId ? "Edit Category" : "New Category"}</h1>
          {editingId ? (
            <button
              type="button"
              className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-700"
              onClick={resetForm}
            >
              Cancel
            </button>
          ) : null}
        </div>

        <section>
          <p className="mb-1.5 text-base font-semibold text-slate-700">Category Type</p>
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

        <label className="block text-sm text-slate-700">
          Category Name
          <input
            className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            value={form.name}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                name: event.target.value,
              }))
            }
            placeholder="Enter category name"
            required
          />
        </label>

        <section>
          <p className="mb-1.5 text-base font-semibold text-slate-700">Choose Icon</p>
          <div className="grid grid-cols-6 gap-2">
            {formIconOptions.map((option, index) => {
              const Icon = option.icon;
              const active = option.value === form.icon;
              const tileColor = ICON_TILE_COLORS[index % ICON_TILE_COLORS.length];
              return (
                <button
                  key={option.value}
                  type="button"
                  className={`rounded-xl border p-2 ${active ? "border-[var(--accent-primary)]" : "border-slate-200"}`}
                  style={{ backgroundColor: tileColor }}
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      icon: option.value,
                    }))
                  }
                  aria-label={option.label}
                >
                  <Icon className="mx-auto h-4.5 w-4.5 text-slate-700" />
                </button>
              );
            })}
          </div>
        </section>

        <section>
          <p className="mb-1.5 text-base font-semibold text-slate-700">Accent Color</p>
          <div className="grid grid-cols-6 gap-2">
            {["#E0534A", "#1FA66A", "#4F7EF6", "#8E5BE8", "#E77F2E", "#D65497"].map((color) => {
              const active = color === form.color;
              return (
                <button
                  key={color}
                  type="button"
                  className={`h-8 rounded-lg border-2 ${active ? "border-slate-700" : "border-transparent"}`}
                  style={{ backgroundColor: color }}
                  onClick={() => setForm((prev) => ({ ...prev, color }))}
                  aria-label={color}
                />
              );
            })}
          </div>
        </section>

        <section className="mobile-card p-3">
          <p className="mb-2 text-sm font-semibold text-slate-600">Preview</p>
          <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2.5">
                <span
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl"
                  style={{ backgroundColor: toSoftBackground(form.color, 0.2), color: form.color }}
                >
                  <PreviewIcon className="h-4.5 w-4.5" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-800">
                    {form.name.trim() || "Custom Category"}
                  </p>
                  <p className="truncate text-xs text-slate-500">New category</p>
                </div>
              </div>
              <div className="text-right">
                <p className={`text-2xl font-bold ${form.type === "expense" ? "text-rose-600" : "text-emerald-600"}`}>
                  $0.00
                </p>
                <p className="text-xs text-slate-500">0 transactions</p>
              </div>
            </div>
          </div>
        </section>

        {errorMessage ? <p className="text-sm font-medium text-rose-700">{errorMessage}</p> : null}

        <button
          type="submit"
          className="w-full rounded-xl bg-[var(--accent-primary)] px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--accent-primary-strong)] disabled:cursor-not-allowed disabled:opacity-70"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Saving..." : editingId ? "Save" : "Create Category"}
        </button>
      </form>

      <section className="mobile-card p-3">
        <p className="mb-1.5 text-sm font-semibold text-slate-600">Filter</p>
        <SegmentedControl
          options={[
            { key: "all", label: "All" },
            { key: "expense", label: "Expense" },
            { key: "income", label: "Income" },
          ]}
          value={filter}
          onChange={setFilter}
        />
      </section>

      <section className="space-y-2">
        {isLoading ? <LoadingState message="Загружаем категории..." /> : null}
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
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span
                        className="inline-flex h-10 w-10 items-center justify-center rounded-xl"
                        style={{ backgroundColor: `${category.color}33`, color: category.color }}
                      >
                        <CategoryIcon className="h-4.5 w-4.5" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-800">{category.name}</p>
                        <p className="text-xs text-slate-500">{category.type === "expense" ? "Expense" : "Income"}</p>
                      </div>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${
                        category.type === "expense" ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"
                      }`}
                    >
                      {category.type === "expense" ? <Minus className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                      {category.type}
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-lg bg-white/80 px-2.5 py-1.5 text-xs font-semibold text-slate-700"
                      onClick={() => handleEdit(category)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </button>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-lg bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700"
                      onClick={() => void handleDelete(category.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </button>
                  </div>
                </article>
              );
            })
          : null}
      </section>
    </section>
  );
}
