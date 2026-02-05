"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Minus, Pencil, Plus, Trash2 } from "lucide-react";
import { EmptyState, ErrorState, LoadingState } from "@/components/async-state";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { ApiError } from "@/lib/api-client";
import { getIconOption } from "@/lib/icon-catalog";
import { useAuth } from "@/features/auth/auth-context";
import type { CategoryResponse, CategoryType } from "@/lib/types";

type CategoryFilter = CategoryType | "all";

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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [filter, setFilter] = useState<CategoryFilter>("all");

  const filteredCategories = useMemo(() => {
    if (filter === "all") {
      return categories;
    }
    return categories.filter((category) => category.type === filter);
  }, [categories, filter]);

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

  return (
    <section className="space-y-3">
      <section className="mobile-card p-3">
        <div className="flex items-center justify-between">
          <h1 className="section-title text-[1.35rem]">Categories</h1>
          <Link
            href="/categories/new"
            className="rounded-xl bg-[var(--accent-primary)] px-3 py-2 text-sm font-semibold text-white"
          >
            New
          </Link>
        </div>
      </section>

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

      {errorMessage ? <ErrorState message={errorMessage} /> : null}

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
                    <Link
                      href={`/categories/${category.id}/edit`}
                      className="inline-flex items-center gap-1 rounded-lg bg-white/80 px-2.5 py-1.5 text-xs font-semibold text-slate-700"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </Link>
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
