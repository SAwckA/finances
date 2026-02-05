"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  Accordion,
  AccordionItem,
  Button,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  useDisclosure,
} from "@heroui/react";
import { CopyPlus, Plus, Trash2 } from "lucide-react";
import { EmptyState, ErrorState, LoadingState } from "@/components/async-state";
import { ColorPickerField } from "@/components/color-picker-field";
import { IconPickerField } from "@/components/icon-picker-field";
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
  const {
    isOpen: isTemplateModalOpen,
    onOpen: onTemplateModalOpen,
    onOpenChange: onTemplateModalOpenChange,
    onClose: onTemplateModalClose,
  } = useDisclosure();
  const {
    isOpen: isCreateListModalOpen,
    onOpen: onCreateListModalOpen,
    onOpenChange: onCreateListModalOpenChange,
    onClose: onCreateListModalClose,
  } = useDisclosure();

  const [templates, setTemplates] = useState<ShoppingTemplateResponse[]>([]);
  const [accounts, setAccounts] = useState<AccountResponse[]>([]);
  const [categories, setCategories] = useState<CategoryResponse[]>([]);
  const [templateForm, setTemplateForm] = useState<TemplateFormState>(DEFAULT_TEMPLATE_FORM);
  const [createListForm, setCreateListForm] = useState<CreateListFormState>(DEFAULT_CREATE_LIST_FORM);
  const [editingTemplateId, setEditingTemplateId] = useState<number | null>(null);
  const [sourceTemplate, setSourceTemplate] = useState<ShoppingTemplateResponse | null>(null);
  const [itemDrafts, setItemDrafts] = useState<Record<number, TemplateItemDraftState>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

  const resetTemplateForm = () => {
    setEditingTemplateId(null);
    setTemplateForm({
      ...DEFAULT_TEMPLATE_FORM,
      defaultAccountId: accounts[0] ? String(accounts[0].id) : "",
      defaultCategoryId: expenseCategories[0] ? String(expenseCategories[0].id) : "",
    });
  };

  const openCreateTemplateModal = () => {
    resetTemplateForm();
    onTemplateModalOpen();
  };

  const openEditTemplateModal = (template: ShoppingTemplateResponse) => {
    setEditingTemplateId(template.id);
    setTemplateForm({
      name: template.name,
      color: template.color,
      icon: template.icon,
      defaultAccountId: template.default_account_id ? String(template.default_account_id) : "",
      defaultCategoryId: template.default_category_id ? String(template.default_category_id) : "",
    });
    onTemplateModalOpen();
  };

  const closeTemplateModal = () => {
    onTemplateModalClose();
    resetTemplateForm();
  };

  const openCreateListModal = (template: ShoppingTemplateResponse) => {
    setSourceTemplate(template);
    setCreateListForm({
      name: `${template.name} (${new Date().toLocaleDateString("ru-RU")})`,
      accountId: template.default_account_id ? String(template.default_account_id) : "",
      categoryId: template.default_category_id ? String(template.default_category_id) : "",
    });
    onCreateListModalOpen();
  };

  const closeCreateListModal = () => {
    setSourceTemplate(null);
    setCreateListForm(DEFAULT_CREATE_LIST_FORM);
    onCreateListModalClose();
  };

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

      closeTemplateModal();
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
      closeCreateListModal();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="space-y-3">
      <section className="mobile-card p-3">
        <h1 className="section-title text-[1.35rem]">Shopping Templates</h1>
        <p className="section-caption">Reusable packs of goods to create lists in one click.</p>
        <div className="flex items-center justify-between gap-2">
          <Button size="sm" variant="flat" isLoading={isRefreshing} onPress={() => void loadData()}>
            Refresh
          </Button>
          <Button color="primary" size="sm" startContent={<Plus className="h-4 w-4" />} onPress={openCreateTemplateModal}>
            New template
          </Button>
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
                      <span className="truncate text-sm font-semibold text-slate-900">{template.name}</span>
                    </div>
                  }
                  subtitle={
                    <p className="truncate text-xs text-slate-600">
                      {account?.name ?? "Счет не задан"} · {category?.name ?? "Категория не задана"}
                    </p>
                  }
                >
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="flat" onPress={() => openEditTemplateModal(template)}>
                        Изменить
                      </Button>
                      <Button
                        size="sm"
                        color="primary"
                        variant="flat"
                        startContent={<CopyPlus className="h-4 w-4" />}
                        onPress={() => openCreateListModal(template)}
                      >
                        Создать список
                      </Button>
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
                        <p className="text-sm text-slate-600">Товаров в шаблоне пока нет.</p>
                      ) : (
                        template.items.map((item) => (
                          <article
                            key={item.id}
                            className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2"
                          >
                            <p className="text-sm text-slate-800">
                              {item.name} · {item.default_quantity} шт.
                            </p>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-slate-700">
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
                      className="rounded-xl border border-slate-200 bg-white p-2.5"
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

      <Modal
        isOpen={isTemplateModalOpen}
        onOpenChange={onTemplateModalOpenChange}
        scrollBehavior="inside"
        placement="center"
      >
        <ModalContent>
          <form onSubmit={handleSaveTemplate}>
            <ModalHeader>{editingTemplateId ? "Редактировать шаблон" : "Новый шаблон"}</ModalHeader>
            <ModalBody className="space-y-2.5">
              <Input
                label="Название"
                value={templateForm.name}
                onValueChange={(value) => setTemplateForm((prev) => ({ ...prev, name: value }))}
                isRequired
              />
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
              <label className="block text-sm text-slate-700">
                Счет по умолчанию
                <select
                  className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
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
              </label>
              <label className="block text-sm text-slate-700">
                Категория по умолчанию
                <select
                  className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
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
              </label>
            </ModalBody>
            <ModalFooter>
              <Button variant="flat" type="button" onPress={closeTemplateModal}>
                Отмена
              </Button>
              <Button color="primary" type="submit" isLoading={isSubmitting}>
                {editingTemplateId ? "Сохранить" : "Создать"}
              </Button>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>

      <Modal
        isOpen={isCreateListModalOpen}
        onOpenChange={onCreateListModalOpenChange}
        scrollBehavior="inside"
        placement="center"
      >
        <ModalContent>
          <form onSubmit={handleCreateList}>
            <ModalHeader>Создать список из шаблона</ModalHeader>
            <ModalBody className="space-y-2">
              <Input
                label="Название списка"
                value={createListForm.name}
                onValueChange={(value) => setCreateListForm((prev) => ({ ...prev, name: value }))}
              />
              <label className="block text-sm text-slate-700">
                Счет
                <select
                  className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
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
              </label>
              <label className="block text-sm text-slate-700">
                Категория
                <select
                  className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
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
              </label>
            </ModalBody>
            <ModalFooter>
              <Button variant="flat" type="button" onPress={closeCreateListModal}>
                Отмена
              </Button>
              <Button color="primary" type="submit" isLoading={isSubmitting}>
                Создать
              </Button>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>
    </section>
  );
}
