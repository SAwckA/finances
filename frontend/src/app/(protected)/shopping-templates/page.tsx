"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Accordion, AccordionItem, Button, Input } from "@heroui/react";
import { CopyPlus, Plus, Trash2 } from "lucide-react";
import { EmptyState, ErrorState, LoadingState } from "@/components/async-state";
import { ColorPickerField } from "@/components/color-picker-field";
import { IconPickerField } from "@/components/icon-picker-field";
import { UiTopBar } from "@/components/ui/ui-top-bar";
import { useAuth } from "@/features/auth/auth-context";
import { ApiError } from "@/lib/api-client";
import { getIconOption } from "@/lib/icon-catalog";
import type {
  AccountResponse,
  CategoryResponse,
  ShoppingTemplateCreate,
  ShoppingTemplateItemCreate,
  ShoppingTemplateResponse,
  ShoppingTemplateUpdate,
} from "@/lib/types";

type TemplateFormState = {
  name: string;
  color: string;
  icon: string;
  defaultAccountId: string;
  defaultCategoryId: string;
};

type TemplateItemDraftState = {
  name: string;
  quantity: string;
  price: string;
};

type CreateListFormState = {
  name: string;
  accountId: string;
  categoryId: string;
};

const TEMPLATE_FORM_ID = "shopping-template-editor-form";
const CREATE_LIST_FORM_ID = "shopping-template-create-list-form";

const DEFAULT_TEMPLATE_FORM: TemplateFormState = {
  name: "",
  color: "#2563EB",
  icon: "shopping-cart",
  defaultAccountId: "",
  defaultCategoryId: "",
};

const DEFAULT_ITEM_DRAFT: TemplateItemDraftState = {
  name: "",
  quantity: "1",
  price: "",
};

const DEFAULT_CREATE_LIST_FORM: CreateListFormState = {
  name: "",
  accountId: "",
  categoryId: "",
};

const FORM_FIELD_SHELL_CLASS =
  "mt-1 flex items-center gap-2 rounded-2xl bg-gradient-to-br from-content2/82 to-content1 px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_10px_22px_rgba(2,6,23,0.18)] transition focus-within:shadow-[0_0_0_2px_var(--ring-primary),inset_0_1px_0_rgba(255,255,255,0.1),0_12px_24px_rgba(2,6,23,0.24)]";

const FORM_FIELD_INPUT_CLASS =
  "w-full bg-transparent py-0.5 text-base font-semibold text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] outline-none";

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return `Ошибка API (${error.status}). Проверьте данные и попробуйте снова.`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Что-то пошло не так. Попробуйте снова.";
}

function toSoftBackground(hexColor: string, alpha: number): string {
  const hex = hexColor.replace("#", "");
  const normalized = hex.length === 3 ? hex.split("").map((char) => `${char}${char}`).join("") : hex;

  if (normalized.length !== 6) {
    return "rgba(148, 163, 184, 0.1)";
  }

  const value = Number.parseInt(normalized, 16);
  if (Number.isNaN(value)) {
    return "rgba(148, 163, 184, 0.1)";
  }

  const red = (value >> 16) & 255;
  const green = (value >> 8) & 255;
  const blue = value & 255;
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

export default function ShoppingTemplatesPage() {
  const { authenticatedRequest } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [templates, setTemplates] = useState<ShoppingTemplateResponse[]>([]);
  const [accounts, setAccounts] = useState<AccountResponse[]>([]);
  const [categories, setCategories] = useState<CategoryResponse[]>([]);
  const [templateForm, setTemplateForm] = useState<TemplateFormState>(DEFAULT_TEMPLATE_FORM);
  const [createListForm, setCreateListForm] = useState<CreateListFormState>(DEFAULT_CREATE_LIST_FORM);
  const [editingTemplateId, setEditingTemplateId] = useState<number | null>(null);
  const [sourceTemplate, setSourceTemplate] = useState<ShoppingTemplateResponse | null>(null);
  const [itemDrafts, setItemDrafts] = useState<Record<number, TemplateItemDraftState>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isEditorLoading, setIsEditorLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const createParam = searchParams.get("create");
  const editParam = searchParams.get("edit");
  const createListParam = searchParams.get("createList");
  const isCreateMode = createParam === "1" || createParam === "true";
  const parsedEditId = editParam ? Number(editParam) : null;
  const editTemplateId = Number.isInteger(parsedEditId) && (parsedEditId as number) > 0 ? (parsedEditId as number) : null;
  const parsedCreateListId = createListParam ? Number(createListParam) : null;
  const createListTemplateId =
    Number.isInteger(parsedCreateListId) && (parsedCreateListId as number) > 0
      ? (parsedCreateListId as number)
      : null;
  const isTemplateEditorOpen = isCreateMode || editTemplateId !== null;
  const isCreateListEditorOpen = createListTemplateId !== null;

  const accountById = useMemo(
    () => new Map(accounts.map((account) => [account.id, account])),
    [accounts],
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
      const [templatesData, accountsData, categoriesData] = await Promise.all([
        authenticatedRequest<ShoppingTemplateResponse[]>("/api/shopping-templates?skip=0&limit=200"),
        authenticatedRequest<AccountResponse[]>("/api/accounts?skip=0&limit=300"),
        authenticatedRequest<CategoryResponse[]>("/api/categories?skip=0&limit=300"),
      ]);
      setTemplates(templatesData);
      setAccounts(accountsData);
      setCategories(categoriesData);
      setItemDrafts((prev) => {
        const next: Record<number, TemplateItemDraftState> = {};
        for (const template of templatesData) {
          next[template.id] = prev[template.id] ?? DEFAULT_ITEM_DRAFT;
        }
        return next;
      });
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [authenticatedRequest]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const clearEditorParams = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("create");
    params.delete("edit");
    params.delete("createList");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  const buildHref = useCallback(
    (name: "create" | "edit" | "createList", value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(name, value);
      } else {
        params.delete(name);
      }

      if (name === "create") {
        params.delete("edit");
        params.delete("createList");
      }
      if (name === "edit") {
        params.delete("create");
        params.delete("createList");
      }
      if (name === "createList") {
        params.delete("create");
        params.delete("edit");
      }

      const query = params.toString();
      return query ? `${pathname}?${query}` : pathname;
    },
    [pathname, searchParams],
  );

  useEffect(() => {
    if (!isTemplateEditorOpen) {
      setEditingTemplateId(null);
      setIsEditorLoading(false);
      return;
    }

    if (isCreateMode) {
      setEditingTemplateId(null);
      setIsEditorLoading(false);
      setTemplateForm({
        ...DEFAULT_TEMPLATE_FORM,
        defaultAccountId: accounts[0] ? String(accounts[0].id) : "",
        defaultCategoryId: expenseCategories[0] ? String(expenseCategories[0].id) : "",
      });
      return;
    }

    if (!editTemplateId) {
      return;
    }

    const localTemplate = templates.find((template) => template.id === editTemplateId);
    if (localTemplate) {
      setEditingTemplateId(localTemplate.id);
      setIsEditorLoading(false);
      setTemplateForm({
        name: localTemplate.name,
        color: localTemplate.color,
        icon: localTemplate.icon,
        defaultAccountId: localTemplate.default_account_id ? String(localTemplate.default_account_id) : "",
        defaultCategoryId: localTemplate.default_category_id ? String(localTemplate.default_category_id) : "",
      });
      return;
    }

    let active = true;
    const loadById = async () => {
      setIsEditorLoading(true);
      try {
        const template = await authenticatedRequest<ShoppingTemplateResponse>(
          `/api/shopping-templates/${editTemplateId}`,
        );
        if (!active) {
          return;
        }
        setEditingTemplateId(template.id);
        setTemplateForm({
          name: template.name,
          color: template.color,
          icon: template.icon,
          defaultAccountId: template.default_account_id ? String(template.default_account_id) : "",
          defaultCategoryId: template.default_category_id ? String(template.default_category_id) : "",
        });
      } catch (error) {
        if (active) {
          setErrorMessage(getErrorMessage(error));
        }
      } finally {
        if (active) {
          setIsEditorLoading(false);
        }
      }
    };

    void loadById();
    return () => {
      active = false;
    };
  }, [
    accounts,
    authenticatedRequest,
    editTemplateId,
    expenseCategories,
    isCreateMode,
    isTemplateEditorOpen,
    templates,
  ]);

  useEffect(() => {
    if (!isCreateListEditorOpen) {
      setSourceTemplate(null);
      setCreateListForm(DEFAULT_CREATE_LIST_FORM);
      return;
    }

    const template = templates.find((item) => item.id === createListTemplateId) ?? null;
    if (!template) {
      return;
    }

    setSourceTemplate(template);
    setCreateListForm({
      name: `${template.name} (${new Date().toLocaleDateString("ru-RU")})`,
      accountId: template.default_account_id ? String(template.default_account_id) : "",
      categoryId: template.default_category_id ? String(template.default_category_id) : "",
    });
  }, [createListTemplateId, isCreateListEditorOpen, templates]);

  const handleSaveTemplate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!templateForm.name || !templateForm.color || !templateForm.icon) {
      setErrorMessage("Заполните обязательные поля шаблона.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      if (editingTemplateId) {
        const payload: ShoppingTemplateUpdate = {
          name: templateForm.name.trim(),
          color: templateForm.color,
          icon: templateForm.icon,
          default_account_id: templateForm.defaultAccountId ? Number(templateForm.defaultAccountId) : null,
          default_category_id: templateForm.defaultCategoryId ? Number(templateForm.defaultCategoryId) : null,
        };
        await authenticatedRequest(`/api/shopping-templates/${editingTemplateId}`, {
          method: "PATCH",
          body: payload,
        });
      } else {
        const payload: ShoppingTemplateCreate = {
          name: templateForm.name.trim(),
          color: templateForm.color,
          icon: templateForm.icon,
          default_account_id: templateForm.defaultAccountId ? Number(templateForm.defaultAccountId) : null,
          default_category_id: templateForm.defaultCategoryId ? Number(templateForm.defaultCategoryId) : null,
          items: [],
        };
        await authenticatedRequest("/api/shopping-templates", { method: "POST", body: payload });
      }

      clearEditorParams();
      await loadData();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTemplate = async (templateId: number) => {
    if (!window.confirm("Удалить шаблон?")) {
      return;
    }

    setErrorMessage(null);
    try {
      await authenticatedRequest(`/api/shopping-templates/${templateId}`, { method: "DELETE" });
      await loadData();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  };

  const updateItemDraft = (templateId: number, patch: Partial<TemplateItemDraftState>) => {
    setItemDrafts((prev) => ({
      ...prev,
      [templateId]: { ...(prev[templateId] ?? DEFAULT_ITEM_DRAFT), ...patch },
    }));
  };

  const handleAddItem = async (templateId: number) => {
    const draft = itemDrafts[templateId] ?? DEFAULT_ITEM_DRAFT;
    if (!draft.name.trim()) {
      setErrorMessage("Введите название товара.");
      return;
    }

    setErrorMessage(null);
    setPendingKey(`add:${templateId}`);
    try {
      const payload: ShoppingTemplateItemCreate = {
        name: draft.name.trim(),
        default_quantity: Math.max(1, Number(draft.quantity) || 1),
        default_price: draft.price ? Number(draft.price) : null,
      };
      await authenticatedRequest(`/api/shopping-templates/${templateId}/items`, {
        method: "POST",
        body: payload,
      });
      setItemDrafts((prev) => ({ ...prev, [templateId]: DEFAULT_ITEM_DRAFT }));
      await loadData();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setPendingKey(null);
    }
  };

  const handleDeleteItem = async (templateId: number, itemId: number) => {
    setErrorMessage(null);
    setPendingKey(`delete:${itemId}`);
    try {
      await authenticatedRequest(`/api/shopping-templates/${templateId}/items/${itemId}`, {
        method: "DELETE",
      });
      await loadData();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setPendingKey(null);
    }
  };

  const handleCreateList = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!sourceTemplate) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const query = new URLSearchParams();
      if (createListForm.name.trim()) {
        query.set("name", createListForm.name.trim());
      }
      if (createListForm.accountId) {
        query.set("account_id", createListForm.accountId);
      }
      if (createListForm.categoryId) {
        query.set("category_id", createListForm.categoryId);
      }

      const suffix = query.toString() ? `?${query.toString()}` : "";
      await authenticatedRequest(`/api/shopping-templates/${sourceTemplate.id}/create-list${suffix}`, {
        method: "POST",
      });
      clearEditorParams();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isTemplateEditorOpen) {
    return (
      <section className="fixed inset-0 z-50 overscroll-contain bg-[var(--bg-app)]">
        <div className="mx-auto flex h-full w-full max-w-[430px] flex-col">
          <UiTopBar
            title={editingTemplateId ? "Редактирование шаблона" : "Новый шаблон"}
            onBack={clearEditorParams}
            formId={TEMPLATE_FORM_ID}
            isSaving={isSubmitting}
          />
          <div className="flex-1 overflow-y-auto px-3 py-3">
            {isEditorLoading ? <LoadingState message="Загружаем шаблон..." /> : null}
            {!isEditorLoading ? (
              <form id={TEMPLATE_FORM_ID} className="app-panel space-y-3 p-3" onSubmit={handleSaveTemplate}>
                <label className="block text-sm text-[var(--text-secondary)]">
                  Название
                  <div className={FORM_FIELD_SHELL_CLASS}>
                    <input
                      className={FORM_FIELD_INPUT_CLASS}
                      value={templateForm.name}
                      onChange={(event) => setTemplateForm((prev) => ({ ...prev, name: event.target.value }))}
                      placeholder="Введите название шаблона…"
                      required
                    />
                  </div>
                </label>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <ColorPickerField
                    label="Цвет"
                    value={templateForm.color}
                    onChange={(value) => setTemplateForm((prev) => ({ ...prev, color: value }))}
                  />
                  <IconPickerField
                    label="Иконка"
                    value={templateForm.icon}
                    onChange={(value) => setTemplateForm((prev) => ({ ...prev, icon: value }))}
                  />
                </div>
                <label className="block text-sm text-[var(--text-secondary)]">
                  Счет по умолчанию
                  <div className={FORM_FIELD_SHELL_CLASS}>
                    <select
                      className={FORM_FIELD_INPUT_CLASS}
                      value={templateForm.defaultAccountId}
                      onChange={(event) =>
                        setTemplateForm((prev) => ({ ...prev, defaultAccountId: event.target.value }))
                      }
                    >
                      <option value="">Не указан</option>
                      {accounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </label>
                <label className="block text-sm text-[var(--text-secondary)]">
                  Категория по умолчанию
                  <div className={FORM_FIELD_SHELL_CLASS}>
                    <select
                      className={FORM_FIELD_INPUT_CLASS}
                      value={templateForm.defaultCategoryId}
                      onChange={(event) =>
                        setTemplateForm((prev) => ({ ...prev, defaultCategoryId: event.target.value }))
                      }
                    >
                      <option value="">Не указана</option>
                      {expenseCategories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </label>
                {errorMessage ? <ErrorState message={errorMessage} /> : null}
              </form>
            ) : null}
          </div>
        </div>
      </section>
    );
  }

  if (isCreateListEditorOpen) {
    return (
      <section className="fixed inset-0 z-50 overscroll-contain bg-[var(--bg-app)]">
        <div className="mx-auto flex h-full w-full max-w-[430px] flex-col">
          <UiTopBar
            title="Создать список из шаблона"
            onBack={clearEditorParams}
            formId={CREATE_LIST_FORM_ID}
            isSaving={isSubmitting}
            primaryLabel="Создать"
          />
          <div className="flex-1 overflow-y-auto px-3 py-3">
            <form id={CREATE_LIST_FORM_ID} className="app-panel space-y-3 p-3" onSubmit={handleCreateList}>
              <label className="block text-sm text-[var(--text-secondary)]">
                Название списка
                <div className={FORM_FIELD_SHELL_CLASS}>
                  <input
                    className={FORM_FIELD_INPUT_CLASS}
                    value={createListForm.name}
                    onChange={(event) => setCreateListForm((prev) => ({ ...prev, name: event.target.value }))}
                    placeholder="Введите название списка…"
                  />
                </div>
              </label>
              <label className="block text-sm text-[var(--text-secondary)]">
                Счет
                <div className={FORM_FIELD_SHELL_CLASS}>
                  <select
                    className={FORM_FIELD_INPUT_CLASS}
                    value={createListForm.accountId}
                    onChange={(event) => setCreateListForm((prev) => ({ ...prev, accountId: event.target.value }))}
                  >
                    <option value="">Использовать из шаблона</option>
                    {accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                  </select>
                </div>
              </label>
              <label className="block text-sm text-[var(--text-secondary)]">
                Категория
                <div className={FORM_FIELD_SHELL_CLASS}>
                  <select
                    className={FORM_FIELD_INPUT_CLASS}
                    value={createListForm.categoryId}
                    onChange={(event) => setCreateListForm((prev) => ({ ...prev, categoryId: event.target.value }))}
                  >
                    <option value="">Использовать из шаблона</option>
                    {expenseCategories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>
              </label>
              {sourceTemplate ? (
                <p className="text-xs text-[var(--text-secondary)]">
                  Список будет создан на основе шаблона «{sourceTemplate.name}».
                </p>
              ) : null}
              {errorMessage ? <ErrorState message={errorMessage} /> : null}
            </form>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <section className="app-panel p-3">
        <h1 className="section-title text-[1.35rem]">Шаблоны покупок</h1>
        <p className="section-caption">Переиспользуемые наборы товаров для быстрого создания списков.</p>
        <div className="mt-3 flex items-center justify-between gap-2">
          <Button size="sm" variant="flat" isLoading={isRefreshing} onPress={() => void loadData()}>
            Обновить
          </Button>
          <Link
            href={buildHref("create", "1")}
            scroll={false}
            className="inline-flex items-center gap-1 rounded-xl bg-[var(--accent-primary)] px-3 py-2 text-sm font-semibold text-[var(--text-primary)] transition hover:bg-[var(--accent-primary-strong)]"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Новый шаблон
          </Link>
        </div>
      </section>

      {errorMessage ? <ErrorState message={errorMessage} /> : null}

      <section>
        {isLoading ? <LoadingState message="Загружаем шаблоны..." /> : null}
        {!isLoading && templates.length === 0 ? <EmptyState message="Шаблонов пока нет." /> : null}

        {!isLoading && templates.length > 0 ? (
          <Accordion variant="bordered" isCompact>
            {templates.map((template) => {
              const TemplateIcon = getIconOption(template.icon).icon;
              const account = template.default_account_id
                ? accountById.get(template.default_account_id)
                : null;
              const category = template.default_category_id
                ? categoryById.get(template.default_category_id)
                : null;
              const draft = itemDrafts[template.id] ?? DEFAULT_ITEM_DRAFT;

              return (
                <AccordionItem
                  key={template.id}
                  aria-label={`Шаблон ${template.name}`}
                  title={
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-black/10"
                        style={{ backgroundColor: toSoftBackground(template.color, 0.2), color: template.color }}
                      >
                        <TemplateIcon className="h-4 w-4" />
                      </span>
                      <span className="truncate text-sm font-semibold text-default-900">{template.name}</span>
                    </div>
                  }
                  subtitle={
                    <p className="truncate text-xs text-default-600">
                      {account?.name ?? "Счет не задан"} · {category?.name ?? "Категория не задана"}
                    </p>
                  }
                >
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={buildHref("edit", String(template.id))}
                        scroll={false}
                        className="inline-flex items-center rounded-xl border border-[color:var(--border-soft)] bg-[var(--bg-card)] px-3 py-1.5 text-sm font-medium text-[var(--text-secondary)] transition hover:bg-[var(--surface-hover)]"
                      >
                        Изменить
                      </Link>
                      <Link
                        href={buildHref("createList", String(template.id))}
                        scroll={false}
                        className="inline-flex items-center gap-1 rounded-xl border border-primary-300/50 bg-primary-500/10 px-3 py-1.5 text-sm font-medium text-primary-700 transition hover:bg-primary-500/15"
                      >
                        <CopyPlus className="h-4 w-4" />
                        Создать список
                      </Link>
                      <Button
                        size="sm"
                        color="danger"
                        variant="flat"
                        onPress={() => void handleDeleteTemplate(template.id)}
                      >
                        Удалить
                      </Button>
                    </div>

                    <div className="space-y-2">
                      {template.items.length === 0 ? (
                        <p className="text-sm text-default-600">Товаров в шаблоне пока нет.</p>
                      ) : (
                        template.items.map((item) => (
                          <article
                            key={item.id}
                            className="flex items-center justify-between rounded-xl border border-default-200 bg-default-50 px-2.5 py-2"
                          >
                            <p className="text-sm text-default-800">
                              {item.name} · {item.default_quantity} шт.
                            </p>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-default-700">
                                {item.default_price ? `${item.default_price} ₽` : "Без цены"}
                              </span>
                              <Button
                                isIconOnly
                                size="sm"
                                variant="light"
                                color="danger"
                                isLoading={pendingKey === `delete:${item.id}`}
                                onPress={() => void handleDeleteItem(template.id, item.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </article>
                        ))
                      )}
                    </div>

                    <form
                      className="rounded-xl border border-default-200 bg-white p-2.5"
                      onSubmit={(event) => {
                        event.preventDefault();
                        void handleAddItem(template.id);
                      }}
                    >
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                        <Input
                          size="sm"
                          label="Товар"
                          value={draft.name}
                          onValueChange={(value) => updateItemDraft(template.id, { name: value })}
                        />
                        <Input
                          size="sm"
                          label="Кол-во"
                          type="number"
                          min="1"
                          value={draft.quantity}
                          onValueChange={(value) => updateItemDraft(template.id, { quantity: value })}
                        />
                        <Input
                          size="sm"
                          label="Цена по умолчанию"
                          type="number"
                          min="0"
                          step="0.01"
                          value={draft.price}
                          onValueChange={(value) => updateItemDraft(template.id, { price: value })}
                        />
                      </div>
                      <div className="mt-2 flex justify-end">
                        <Button
                          type="submit"
                          color="primary"
                          size="sm"
                          isLoading={pendingKey === `add:${template.id}`}
                          startContent={<Plus className="h-4 w-4" />}
                        >
                          Добавить товар
                        </Button>
                      </div>
                    </form>
                  </div>
                </AccordionItem>
              );
            })}
          </Accordion>
        ) : null}
      </section>
    </section>
  );
}
