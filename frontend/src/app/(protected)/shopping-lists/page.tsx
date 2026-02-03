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
import { Check, Plus, Trash2 } from "lucide-react";
import { EmptyState, ErrorState, LoadingState } from "@/components/async-state";
import { ScreenHeader } from "@/components/screen-header";
import { useAuth } from "@/features/auth/auth-context";
import { ApiError } from "@/lib/api-client";
import type {
  AccountResponse,
  CategoryResponse,
  CurrencyResponse,
  ShoppingItemCreate,
  ShoppingItemResponse,
  ShoppingListCreate,
  ShoppingListResponse,
  ShoppingListStatus,
  ShoppingListUpdate,
} from "@/lib/types";

type StatusFilter = ShoppingListStatus | "all";

type ListFormState = {
  name: string;
  accountId: string;
  categoryId: string;
};

type ItemDraftState = {
  name: string;
  quantity: string;
  price: string;
};

const DEFAULT_LIST_FORM: ListFormState = {
  name: "",
  accountId: "",
  categoryId: "",
};

const DEFAULT_ITEM_DRAFT: ItemDraftState = {
  name: "",
  quantity: "1",
  price: "",
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

function statusMeta(status: ShoppingListStatus): { label: string; className: string } {
  if (status === "confirmed") {
    return {
      label: "Подтвержден",
      className: "border-blue-300 bg-blue-100 text-blue-800",
    };
  }

  if (status === "completed") {
    return {
      label: "Завершен",
      className: "border-emerald-300 bg-emerald-100 text-emerald-800",
    };
  }

  return {
    label: "Черновик",
    className: "border-amber-300 bg-amber-100 text-amber-800",
  };
}

export default function ShoppingListsPage() {
  const { authenticatedRequest } = useAuth();
  const { isOpen, onOpen, onOpenChange, onClose } = useDisclosure();
  const [lists, setLists] = useState<ShoppingListResponse[]>([]);
  const [accounts, setAccounts] = useState<AccountResponse[]>([]);
  const [categories, setCategories] = useState<CategoryResponse[]>([]);
  const [currencies, setCurrencies] = useState<CurrencyResponse[]>([]);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [editingListId, setEditingListId] = useState<number | null>(null);
  const [listForm, setListForm] = useState<ListFormState>(DEFAULT_LIST_FORM);
  const [itemDrafts, setItemDrafts] = useState<Record<number, ItemDraftState>>({});
  const [itemPendingKey, setItemPendingKey] = useState<string | null>(null);

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
      setItemDrafts((prev) => {
        const next: Record<number, ItemDraftState> = {};
        for (const list of listsData) {
          next[list.id] = prev[list.id] ?? DEFAULT_ITEM_DRAFT;
        }
        return next;
      });
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [authenticatedRequest, filter]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const resetListForm = () => {
    setEditingListId(null);
    setListForm({
      ...DEFAULT_LIST_FORM,
      accountId: accounts[0] ? String(accounts[0].id) : "",
      categoryId: expenseCategories[0] ? String(expenseCategories[0].id) : "",
    });
  };

  const openCreateModal = () => {
    resetListForm();
    onOpen();
  };

  const openEditModal = (list: ShoppingListResponse) => {
    setEditingListId(list.id);
    setListForm({
      name: list.name,
      accountId: String(list.account_id),
      categoryId: String(list.category_id),
    });
    onOpen();
  };

  const closeModal = () => {
    onClose();
    resetListForm();
  };

  const handleSaveList = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!listForm.name || !listForm.accountId || !listForm.categoryId) {
      setErrorMessage("Укажите название, счет и категорию.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      if (editingListId) {
        const payload: ShoppingListUpdate = {
          name: listForm.name.trim(),
          account_id: Number(listForm.accountId),
          category_id: Number(listForm.categoryId),
        };
        await authenticatedRequest(`/api/shopping-lists/${editingListId}`, {
          method: "PATCH",
          body: payload,
        });
      } else {
        const payload: ShoppingListCreate = {
          name: listForm.name.trim(),
          account_id: Number(listForm.accountId),
          category_id: Number(listForm.categoryId),
          items: [],
        };
        await authenticatedRequest("/api/shopping-lists", { method: "POST", body: payload });
      }

      closeModal();
      await loadData();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
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

  const handleTransition = async (listId: number, action: "confirm" | "complete") => {
    setErrorMessage(null);
    setItemPendingKey(`${action}:${listId}`);

    try {
      await authenticatedRequest(`/api/shopping-lists/${listId}/${action}`, { method: "POST" });
      await loadData();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setItemPendingKey(null);
    }
  };

  const updateItemDraft = (listId: number, patch: Partial<ItemDraftState>) => {
    setItemDrafts((prev) => ({
      ...prev,
      [listId]: { ...(prev[listId] ?? DEFAULT_ITEM_DRAFT), ...patch },
    }));
  };

  const handleAddItem = async (listId: number) => {
    const draft = itemDrafts[listId] ?? DEFAULT_ITEM_DRAFT;
    if (!draft.name.trim()) {
      setErrorMessage("Введите название товара.");
      return;
    }

    setErrorMessage(null);
    setItemPendingKey(`add:${listId}`);
    try {
      const payload: ShoppingItemCreate = {
        name: draft.name.trim(),
        quantity: Math.max(1, Number(draft.quantity) || 1),
        price: draft.price ? Number(draft.price) : null,
      };
      await authenticatedRequest(`/api/shopping-lists/${listId}/items`, { method: "POST", body: payload });
      setItemDrafts((prev) => ({ ...prev, [listId]: DEFAULT_ITEM_DRAFT }));
      await loadData();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setItemPendingKey(null);
    }
  };

  const handleToggleItem = async (listId: number, item: ShoppingItemResponse) => {
    setErrorMessage(null);
    setItemPendingKey(`check:${item.id}`);
    try {
      await authenticatedRequest(`/api/shopping-lists/${listId}/items/${item.id}`, {
        method: "PATCH",
        body: { is_checked: !item.is_checked },
      });
      await loadData();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setItemPendingKey(null);
    }
  };

  const handleDeleteItem = async (listId: number, itemId: number) => {
    setErrorMessage(null);
    setItemPendingKey(`delete:${itemId}`);
    try {
      await authenticatedRequest(`/api/shopping-lists/${listId}/items/${itemId}`, { method: "DELETE" });
      await loadData();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setItemPendingKey(null);
    }
  };

  return (
    <>
      <ScreenHeader
        title="Списки покупок"
        description="Черновики, подтверждение и завершение списка с автоматической фиксацией транзакции."
      />

      <section className="mb-4 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            {(["all", "draft", "confirmed", "completed"] as StatusFilter[]).map((status) => {
              const active = filter === status;
              const label =
                status === "all"
                  ? "Все"
                  : status === "draft"
                    ? "Черновики"
                    : status === "confirmed"
                      ? "Подтвержденные"
                      : "Завершенные";
              return (
                <Button
                  key={status}
                  size="sm"
                  variant={active ? "solid" : "flat"}
                  color={active ? "primary" : "default"}
                  onPress={() => setFilter(status)}
                >
                  {label}
                </Button>
              );
            })}
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="flat" isLoading={isRefreshing} onPress={() => void loadData()}>
              Обновить
            </Button>
            <Button color="primary" size="sm" startContent={<Plus className="h-4 w-4" />} onPress={openCreateModal}>
              Новый список
            </Button>
          </div>
        </div>
      </section>

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
              const draft = itemDrafts[list.id] ?? DEFAULT_ITEM_DRAFT;

              return (
                <AccordionItem
                  key={list.id}
                  aria-label={`Список ${list.name}`}
                  title={
                    <div className="flex items-start justify-between gap-2 pr-1">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">{list.name}</p>
                        <p className="truncate text-xs text-slate-600">
                          {account?.name ?? "Счет"} · {category?.name ?? "Категория"}
                        </p>
                      </div>
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${status.className}`}>
                        {status.label}
                      </span>
                    </div>
                  }
                  subtitle={
                    <p className="text-xs text-slate-600">
                      Итого: {formatAmount(list.total_amount, currency?.code ?? "RUB")}
                    </p>
                  }
                >
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="flat" onPress={() => openEditModal(list)}>
                        Изменить
                      </Button>
                      {list.status === "draft" ? (
                        <Button
                          size="sm"
                          color="primary"
                          variant="flat"
                          isLoading={itemPendingKey === `confirm:${list.id}`}
                          onPress={() => void handleTransition(list.id, "confirm")}
                        >
                          Подтвердить
                        </Button>
                      ) : null}
                      {list.status === "confirmed" ? (
                        <Button
                          size="sm"
                          color="success"
                          variant="flat"
                          isLoading={itemPendingKey === `complete:${list.id}`}
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
                      {list.items.length === 0 ? (
                        <p className="text-sm text-slate-600">Товаров пока нет.</p>
                      ) : (
                        list.items.map((item) => (
                          <article
                            key={item.id}
                            className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2"
                          >
                            <button
                              type="button"
                              className="flex min-w-0 items-center gap-2 text-left"
                              onClick={() => void handleToggleItem(list.id, item)}
                            >
                              <span
                                className={`inline-flex h-5 w-5 items-center justify-center rounded-md border ${
                                  item.is_checked
                                    ? "border-emerald-400 bg-emerald-500 text-white"
                                    : "border-slate-300 bg-white text-slate-400"
                                }`}
                              >
                                <Check className="h-3 w-3" />
                              </span>
                              <span className={`text-sm ${item.is_checked ? "line-through text-slate-500" : "text-slate-800"}`}>
                                {item.name} · {item.quantity} шт.
                              </span>
                            </button>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-slate-700">
                                {formatAmount(item.total_price, currency?.code ?? "RUB")}
                              </span>
                              <Button
                                isIconOnly
                                size="sm"
                                variant="light"
                                color="danger"
                                isLoading={itemPendingKey === `delete:${item.id}`}
                                onPress={() => void handleDeleteItem(list.id, item.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </article>
                        ))
                      )}
                    </div>

                    {list.status === "draft" ? (
                      <form
                        className="rounded-xl border border-slate-200 bg-white p-2.5"
                        onSubmit={(event) => {
                          event.preventDefault();
                          void handleAddItem(list.id);
                        }}
                      >
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                          <Input
                            size="sm"
                            label="Товар"
                            value={draft.name}
                            onValueChange={(value) => updateItemDraft(list.id, { name: value })}
                          />
                          <Input
                            size="sm"
                            label="Кол-во"
                            type="number"
                            min="1"
                            value={draft.quantity}
                            onValueChange={(value) => updateItemDraft(list.id, { quantity: value })}
                          />
                          <Input
                            size="sm"
                            label={`Цена${currency ? ` (${currency.code})` : ""}`}
                            type="number"
                            min="0"
                            step="0.01"
                            value={draft.price}
                            onValueChange={(value) => updateItemDraft(list.id, { price: value })}
                          />
                        </div>
                        <div className="mt-2 flex justify-end">
                          <Button
                            type="submit"
                            color="primary"
                            size="sm"
                            isLoading={itemPendingKey === `add:${list.id}`}
                            startContent={<Plus className="h-4 w-4" />}
                          >
                            Добавить товар
                          </Button>
                        </div>
                      </form>
                    ) : null}

                    {list.status === "completed" && list.transaction_id ? (
                      <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-2 text-xs text-emerald-800">
                        Список завершен, транзакция создана: #{list.transaction_id}
                      </p>
                    ) : null}
                  </div>
                </AccordionItem>
              );
            })}
          </Accordion>
        ) : null}
      </section>

      <Modal isOpen={isOpen} onOpenChange={onOpenChange} scrollBehavior="inside" placement="center">
        <ModalContent>
          <form onSubmit={handleSaveList}>
            <ModalHeader>{editingListId ? "Редактировать список" : "Новый список"}</ModalHeader>
            <ModalBody className="space-y-2">
              <Input
                label="Название"
                value={listForm.name}
                onValueChange={(value) => setListForm((prev) => ({ ...prev, name: value }))}
                isRequired
              />
              <label className="block text-sm text-slate-700">
                Счет *
                <select
                  className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                  value={listForm.accountId}
                  onChange={(event) => setListForm((prev) => ({ ...prev, accountId: event.target.value }))}
                  required
                >
                  <option value="">Выберите счет</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm text-slate-700">
                Категория расходов *
                <select
                  className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                  value={listForm.categoryId}
                  onChange={(event) => setListForm((prev) => ({ ...prev, categoryId: event.target.value }))}
                  required
                >
                  <option value="">Выберите категорию</option>
                  {expenseCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
            </ModalBody>
            <ModalFooter>
              <Button variant="flat" type="button" onPress={closeModal}>
                Отмена
              </Button>
              <Button color="primary" type="submit" isLoading={isSubmitting}>
                {editingListId ? "Сохранить" : "Создать"}
              </Button>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>
    </>
  );
}
