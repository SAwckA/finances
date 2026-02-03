"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Button, Input } from "@heroui/react";
import { EmptyState, LoadingState } from "@/components/async-state";
import { ColorPickerField } from "@/components/color-picker-field";
import { IconPickerField } from "@/components/icon-picker-field";
import { ScreenHeader } from "@/components/screen-header";
import { ApiError } from "@/lib/api-client";
import { getIconOption } from "@/lib/icon-catalog";
import { useAuth } from "@/features/auth/auth-context";
import type { CategoryCreate, CategoryResponse, CategoryType, CategoryUpdate } from "@/lib/types";

type CategoryFilter = CategoryType | "all";

type CategoryFormState = {
  name: string;
  color: string;
  icon: string;
  type: CategoryType;
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

const DEFAULT_FORM: CategoryFormState = {
  name: "",
  color: "#DC2626",
  icon: "credit-card",
  type: "expense",
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

  const resetForm = () => {
    setForm(DEFAULT_FORM);
    setEditingId(null);
  };

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

    if (!form.name || !form.color || !form.icon) {
      setErrorMessage("Заполните обязательные поля.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const payload: CategoryCreate | CategoryUpdate = {
      name: form.name.trim(),
      color: form.color.trim(),
      icon: form.icon.trim(),
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
    <>
      <ScreenHeader
        title="Категории"
        description="Категории доходов и расходов для аналитики и контроля бюджета."
      />
      <section className="mb-4 rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-base font-semibold text-slate-900">
          {editingId ? "Редактировать категорию" : "Новая категория"}
        </h2>
        <form className="space-y-2.5" onSubmit={handleSubmit}>
          <Input
            label="Название"
            isRequired
            value={form.name}
            onValueChange={(value) => setForm((prev) => ({ ...prev, name: value }))}
          />
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <ColorPickerField
              label="Цвет"
              value={form.color}
              onChange={(value) => setForm((prev) => ({ ...prev, color: value }))}
            />
            <IconPickerField
              label="Иконка"
              value={form.icon}
              onChange={(value) => setForm((prev) => ({ ...prev, icon: value }))}
            />
          </div>
          <label className="block text-sm text-slate-700">
            Тип *
            <select
              className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              value={form.type}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  type: event.target.value as CategoryType,
                }))
              }
            >
              <option value="expense">Расход</option>
              <option value="income">Доход</option>
            </select>
          </label>
          {errorMessage ? <p className="text-sm text-danger">{errorMessage}</p> : null}
          <div className="flex gap-2">
            <Button color="primary" type="submit" isLoading={isSubmitting}>
              {editingId ? "Сохранить" : "Создать"}
            </Button>
            {editingId ? (
              <Button variant="flat" type="button" onPress={resetForm}>
                Отмена
              </Button>
            ) : null}
          </div>
        </form>
      </section>

      <section className="mb-3 flex gap-2">
        {(["all", "expense", "income"] as CategoryFilter[]).map((item) => {
          const active = filter === item;
          const label = item === "all" ? "Все" : item === "expense" ? "Расходы" : "Доходы";
          return (
            <Button
              key={item}
              size="sm"
              variant={active ? "solid" : "flat"}
              color={active ? "primary" : "default"}
              onPress={() => setFilter(item)}
            >
              {label}
            </Button>
          );
        })}
      </section>

      <section className="space-y-3">
        {isLoading ? (
          <LoadingState message="Загружаем категории..." />
        ) : null}

        {!isLoading && filteredCategories.length === 0 ? (
          <EmptyState message="Категории не найдены." />
        ) : null}

        {!isLoading
          ? filteredCategories.map((category) => {
              const iconOption = getIconOption(category.icon);
              const CategoryIcon = iconOption.icon;

              return (
                <article
                  key={category.id}
                  className="rounded-2xl border p-4"
                  style={{
                    borderColor: category.color,
                    backgroundColor: toSoftBackground(category.color, 0.1),
                  }}
                >
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div>
                      <h3 className="flex items-center gap-2 text-base font-semibold text-slate-900">
                        <CategoryIcon className="h-5 w-5 shrink-0" />
                        {category.name}
                      </h3>
                    </div>
                    <span className="rounded-lg border border-black/10 bg-white/70 px-2 py-1 text-xs font-medium text-slate-700">
                      {category.type === "expense" ? "Расход" : "Доход"}
                    </span>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      variant="flat"
                      className="border border-black/10 bg-white/85 text-slate-900 hover:bg-white"
                      onPress={() => handleEdit(category)}
                    >
                      Изменить
                    </Button>
                    <Button
                      size="sm"
                      color="danger"
                      variant="flat"
                      onPress={() => handleDelete(category.id)}
                    >
                      Удалить
                    </Button>
                  </div>
                </article>
              );
            })
          : null}
      </section>
    </>
  );
}
