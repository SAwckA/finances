"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { EditScreenHeader } from "@/components/ui/edit-screen-header";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { ErrorState, LoadingState } from "@/components/async-state";
import { useAuth } from "@/features/auth/auth-context";
import { ApiError } from "@/lib/api-client";
import { getIconOption, ICON_OPTIONS } from "@/lib/icon-catalog";
import type { CategoryCreate, CategoryResponse, CategoryType, CategoryUpdate } from "@/lib/types";

type CategoryEditorScreenProps = {
  categoryId?: number;
};

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

export function CategoryEditorScreen({ categoryId }: CategoryEditorScreenProps) {
  const router = useRouter();
  const { authenticatedRequest } = useAuth();
  const [form, setForm] = useState<CategoryFormState>(DEFAULT_FORM);
  const [isLoading, setIsLoading] = useState(Boolean(categoryId));
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isEdit = Boolean(categoryId);
  const formIconOptions = useMemo(() => ICON_OPTIONS.slice(4, 22), []);
  const PreviewIcon = getIconOption(form.icon).icon;

  useEffect(() => {
    if (!categoryId) {
      return;
    }

    const loadCategory = async () => {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const category = await authenticatedRequest<CategoryResponse>(`/api/categories/${categoryId}`);
        setForm({
          name: category.name,
          color: category.color,
          icon: category.icon,
          type: category.type,
        });
      } catch (error) {
        setErrorMessage(getErrorMessage(error));
      } finally {
        setIsLoading(false);
      }
    };

    void loadCategory();
  }, [authenticatedRequest, categoryId]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.name.trim() || !form.icon || !form.color) {
      setErrorMessage("Заполните обязательные поля.");
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    const payload: CategoryCreate | CategoryUpdate = {
      name: form.name.trim(),
      color: form.color,
      icon: form.icon,
      type: form.type,
    };

    try {
      if (categoryId) {
        await authenticatedRequest(`/api/categories/${categoryId}`, {
          method: "PATCH",
          body: payload,
        });
      } else {
        await authenticatedRequest("/api/categories", { method: "POST", body: payload });
      }
      router.push("/categories");
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="pb-3">
      <EditScreenHeader
        title={isEdit ? "Edit Category" : "New Category"}
        onBack={() => router.back()}
        formId={FORM_ID}
        isSaving={isSaving}
      />

      {isLoading ? <LoadingState className="mt-3" message="Загружаем категорию..." /> : null}

      {!isLoading ? (
        <form id={FORM_ID} className="space-y-3 px-3 pt-3" onSubmit={handleSubmit}>
          <section>
            <p className="mb-1.5 text-base font-semibold text-default-700">Category Type</p>
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

          <label className="block text-sm text-default-700">
            Category Name
            <input
              className="mt-1 block w-full rounded-xl border border-default-300 bg-white px-3 py-2 text-sm"
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="Enter category name"
              required
            />
          </label>

          <section>
            <p className="mb-1.5 text-base font-semibold text-default-700">Choose Icon</p>
            <div className="grid grid-cols-6 gap-2">
              {formIconOptions.map((option, index) => {
                const Icon = option.icon;
                const active = option.value === form.icon;
                const tileColor = ICON_TILE_COLORS[index % ICON_TILE_COLORS.length];
                return (
                  <button
                    key={option.value}
                    type="button"
                    className={`rounded-xl border p-2 ${active ? "border-[var(--accent-primary)]" : "border-default-200"}`}
                    style={{ backgroundColor: tileColor }}
                    onClick={() => setForm((prev) => ({ ...prev, icon: option.value }))}
                    aria-label={option.label}
                  >
                    <Icon className="mx-auto h-4.5 w-4.5 text-default-700" />
                  </button>
                );
              })}
            </div>
          </section>

          <section className="app-panel p-3">
            <p className="mb-2 text-sm font-semibold text-default-600">Preview</p>
            <div className="rounded-2xl border border-default-200 bg-white px-3 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl"
                    style={{ backgroundColor: toSoftBackground(form.color, 0.2), color: form.color }}
                  >
                    <PreviewIcon className="h-4.5 w-4.5" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-default-800">
                      {form.name.trim() || "Custom Category"}
                    </p>
                    <p className="truncate text-xs text-default-500">New category</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-2xl font-bold ${form.type === "expense" ? "text-danger-600" : "text-success-600"}`}>
                    $0.00
                  </p>
                  <p className="text-xs text-default-500">0 transactions</p>
                </div>
              </div>
            </div>
          </section>

          {errorMessage ? <ErrorState message={errorMessage} /> : null}
        </form>
      ) : null}
    </section>
  );
}
