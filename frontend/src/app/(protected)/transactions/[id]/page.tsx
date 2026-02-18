"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent, type SetStateAction } from "react";
import { Chip } from "@heroui/react";
import { ListChecks, Repeat } from "lucide-react";
import { ErrorState, LoadingState } from "@/components/async-state";
import { TransactionEditorHeader } from "@/components/transactions/transaction-editor-header";
import { TransactionFormFields } from "@/components/transactions/transaction-form-fields";
import { HeroChip } from "@/components/ui/hero-chip";
import { HeroInlineAction } from "@/components/ui/hero-inline-action";
import { useAuth } from "@/features/auth/auth-context";
import { ApiError } from "@/lib/api-client";
import type {
  AccountBalanceResponse,
  AccountResponse,
  CategoryResponse,
  CurrencyResponse,
  ShoppingListResponse,
  TransactionResponse,
  TransactionUpdate,
} from "@/lib/types";

type EditTransactionForm = {
  accountId: string;
  targetAccountId: string;
  amount: string;
  targetAmount: string;
  description: string;
  transactionDate: string;
  categoryId: string;
};

function toLocalDateTimeValue(isoValue: string): string {
  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60_000;
    return new Date(now.getTime() - offset).toISOString().slice(0, 16);
  }

  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function createFormState(transaction: TransactionResponse): EditTransactionForm {
  return {
    accountId: String(transaction.account_id),
    targetAccountId: transaction.target_account_id ? String(transaction.target_account_id) : "",
    amount: transaction.amount,
    targetAmount: transaction.type === "transfer" ? transaction.converted_amount ?? "" : "",
    description: transaction.description ?? "",
    transactionDate: toLocalDateTimeValue(transaction.transaction_date),
    categoryId: transaction.category_id ? String(transaction.category_id) : "",
  };
}

function parsePositiveAmount(rawValue: string): number | null {
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
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

function typeBadgeClass(type: TransactionResponse["type"]): string {
  if (type === "income") {
    return "bg-gradient-to-r from-success/24 to-success/10 text-success-600 dark:text-success-200";
  }
  if (type === "expense") {
    return "bg-gradient-to-r from-danger/24 to-danger/10 text-danger-600 dark:text-danger-200";
  }
  return "bg-gradient-to-r from-primary/24 to-primary/10 text-primary-600 dark:text-primary-200";
}

export default function TransactionDetailsPage() {
  const { authenticatedRequest } = useAuth();
  const params = useParams<{ id: string | string[] }>();
  const router = useRouter();

  const idParam = Array.isArray(params.id) ? params.id[0] : params.id;
  const transactionId = Number(idParam);
  const isValidTransactionId = Number.isInteger(transactionId) && transactionId > 0;

  const [transaction, setTransaction] = useState<TransactionResponse | null>(null);
  const [accounts, setAccounts] = useState<AccountResponse[]>([]);
  const [accountBalances, setAccountBalances] = useState<AccountBalanceResponse[]>([]);
  const [categories, setCategories] = useState<CategoryResponse[]>([]);
  const [currencies, setCurrencies] = useState<CurrencyResponse[]>([]);
  const [form, setForm] = useState<EditTransactionForm | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [editErrorMessage, setEditErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [shoppingListDetails, setShoppingListDetails] = useState<ShoppingListResponse | null>(null);
  const [isShoppingListLoading, setIsShoppingListLoading] = useState(false);

  const goBack = useCallback(() => {
    if (window.history.length > 1) {
      router.back();
      return;
    }
    router.replace("/dashboard");
  }, [router]);

  const loadData = useCallback(async () => {
    if (!isValidTransactionId) {
      setErrorMessage("Некорректный идентификатор транзакции.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const [transactionData, accountsData, categoriesData, currenciesData, balancesData] =
        await Promise.all([
          authenticatedRequest<TransactionResponse>(`/api/transactions/${transactionId}`),
          authenticatedRequest<AccountResponse[]>("/api/accounts?skip=0&limit=300"),
          authenticatedRequest<CategoryResponse[]>("/api/categories?skip=0&limit=300"),
          authenticatedRequest<CurrencyResponse[]>("/api/currencies?skip=0&limit=300"),
          authenticatedRequest<AccountBalanceResponse[]>("/api/statistics/balance"),
        ]);

      setTransaction(transactionData);
      setForm(createFormState(transactionData));
      setAccounts(accountsData);
      setCategories(categoriesData);
      setCurrencies(currenciesData);
      setAccountBalances(balancesData);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, [authenticatedRequest, isValidTransactionId, transactionId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!transaction?.shopping_list_id) {
      setShoppingListDetails(null);
      setIsShoppingListLoading(false);
      return;
    }

    let active = true;
    const loadShoppingList = async () => {
      setIsShoppingListLoading(true);
      try {
        const data = await authenticatedRequest<ShoppingListResponse>(
          `/api/shopping-lists/${transaction.shopping_list_id}`,
        );
        if (active) {
          setShoppingListDetails(data);
        }
      } catch {
        if (active) {
          setShoppingListDetails(null);
        }
      } finally {
        if (active) {
          setIsShoppingListLoading(false);
        }
      }
    };

    void loadShoppingList();
    return () => {
      active = false;
    };
  }, [authenticatedRequest, transaction?.shopping_list_id]);

  const saveTransaction = useCallback(async () => {
    if (!transaction || !form) {
      return;
    }

    if (!form.accountId) {
      setEditErrorMessage("Выберите счет.");
      return;
    }

    if (!form.transactionDate) {
      setEditErrorMessage("Укажите дату операции.");
      return;
    }

    if (transaction.type === "transfer" && !form.targetAccountId) {
      setEditErrorMessage("Для перевода нужно выбрать целевой счет.");
      return;
    }

    const parsedAmount = parsePositiveAmount(form.amount);
    if (parsedAmount === null) {
      setEditErrorMessage("Укажите корректную сумму.");
      return;
    }

    setIsSaving(true);
    setEditErrorMessage(null);
    setErrorMessage(null);

    try {
      const payload: TransactionUpdate = {
        account_id: Number(form.accountId),
        target_account_id: transaction.type === "transfer" ? Number(form.targetAccountId) : null,
        amount: parsedAmount,
        description: form.description.trim() || null,
        transaction_date: new Date(form.transactionDate).toISOString(),
        category_id:
          transaction.type === "transfer" ? null : form.categoryId ? Number(form.categoryId) : null,
      };

      const query = new URLSearchParams();
      if (transaction.type === "transfer" && form.targetAmount) {
        const sourceAmount = Number(form.amount);
        const targetAmount = Number(form.targetAmount);
        if (Number.isFinite(sourceAmount) && sourceAmount > 0 && Number.isFinite(targetAmount)) {
          query.set("converted_amount", targetAmount.toString());
          query.set("exchange_rate", (targetAmount / sourceAmount).toString());
        }
      }

      const url = query.toString()
        ? `/api/transactions/${transaction.id}?${query.toString()}`
        : `/api/transactions/${transaction.id}`;

      const updatedTransaction = await authenticatedRequest<TransactionResponse>(url, {
        method: "PATCH",
        body: payload,
      });

      setTransaction(updatedTransaction);
      setForm(createFormState(updatedTransaction));
      goBack();
    } catch (error) {
      setEditErrorMessage(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }, [authenticatedRequest, form, goBack, transaction]);

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      void saveTransaction();
    },
    [saveTransaction],
  );

  const deleteTransaction = useCallback(async () => {
    if (!transaction) {
      return;
    }

    const confirmed = window.confirm("Удалить транзакцию?");
    if (!confirmed) {
      return;
    }

    setIsSaving(true);
    setEditErrorMessage(null);
    setErrorMessage(null);

    try {
      await authenticatedRequest(`/api/transactions/${transaction.id}`, { method: "DELETE" });
      goBack();
    } catch (error) {
      setEditErrorMessage(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }, [authenticatedRequest, goBack, transaction]);

  return (
    <section className="space-y-3 pb-1">
      <TransactionEditorHeader
        title="Edit Transaction"
        onBack={goBack}
        formId={transaction && form ? "transaction-edit-form" : undefined}
        isSaving={isSaving}
      />

      {isLoading ? <LoadingState message="Загружаем транзакцию…" /> : null}
      {errorMessage ? <ErrorState message={errorMessage} /> : null}

      {transaction && form && !isLoading ? (
        <form id="transaction-edit-form" className="space-y-3" onSubmit={handleSubmit}>
          <section className="app-panel space-y-3 p-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-[var(--text-primary)]">Details</div>
              <div className="flex items-center gap-1.5">
                {transaction.recurring_transaction_id ? (
                  <HeroChip>
                    <Repeat className="h-3 w-3" aria-hidden="true" />
                    Повторяющийся платеж
                  </HeroChip>
                ) : null}
                <Chip className={typeBadgeClass(transaction.type)} size="sm" variant="flat">
                  {transaction.type === "income"
                    ? "Income"
                    : transaction.type === "expense"
                      ? "Expense"
                      : "Transfer"}
                </Chip>
              </div>
            </div>

            <TransactionFormFields
              form={form}
              setForm={(updater: SetStateAction<EditTransactionForm>) =>
                setForm((prev) => {
                  const baseState = prev ?? form;
                  return typeof updater === "function"
                    ? (updater as (state: EditTransactionForm) => EditTransactionForm)(baseState)
                    : updater;
                })
              }
              transactionType={transaction.type}
              accounts={accounts}
              accountBalances={accountBalances}
              categories={categories}
              currencies={currencies}
              showTypeSelector={false}
            />

            {transaction.recurring_transaction_id ? (
              <section className="rounded-2xl bg-gradient-to-b from-content2/78 to-content1 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_10px_20px_rgba(2,6,23,0.2)]">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-secondary)]">
                  Recurring Source
                </p>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <p className="text-sm text-[var(--text-primary)]">
                    Операция создана из регулярного платежа #{transaction.recurring_transaction_id}
                  </p>
                  <HeroInlineAction href={`/recurring?focus=${transaction.recurring_transaction_id}`}>
                    Open
                  </HeroInlineAction>
                </div>
              </section>
            ) : null}

            {editErrorMessage ? <ErrorState message={editErrorMessage} /> : null}
          </section>

          {transaction.shopping_list_id ? (
            <section className="app-panel space-y-2 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--surface-hover)] text-[var(--text-secondary)]">
                    <ListChecks className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">
                    {shoppingListDetails?.name ?? "Список покупок"}
                  </p>
                </div>
                <HeroInlineAction href={`/shopping-lists/${transaction.shopping_list_id}`}>Open</HeroInlineAction>
              </div>

              {isShoppingListLoading ? <LoadingState message="Загружаем список покупок…" /> : null}

              {!isShoppingListLoading && shoppingListDetails ? (
                <ul className="space-y-1">
                  {shoppingListDetails.items.length === 0 ? (
                    <li className="text-xs text-[var(--text-secondary)]">Список пуст.</li>
                  ) : (
                    shoppingListDetails.items.map((item, index) => (
                      <li
                        key={item.id}
                        className="flex items-baseline gap-2 text-sm text-[var(--text-secondary)]"
                      >
                        <span className="text-[var(--text-primary)]">{index + 1}.</span>
                        <span className="truncate text-[var(--text-primary)]">{item.name}</span>
                        <span className="mx-1 h-px flex-1 bg-gradient-to-r from-content2/40 via-content3/70 to-content2/40" />
                        <span className="shrink-0 text-[var(--text-secondary)]">{item.quantity} шт.</span>
                      </li>
                    ))
                  )}
                </ul>
              ) : null}

              {!isShoppingListLoading && !shoppingListDetails ? (
                <p className="text-xs text-[var(--text-secondary)]">Список покупок не найден.</p>
              ) : null}
            </section>
          ) : null}

          <section className="app-panel p-3">
            <button
              type="button"
              className="w-full rounded-xl bg-danger-50 px-3 py-2.5 text-sm font-semibold text-danger-700 transition hover:bg-danger-100 dark:bg-danger-500/15 dark:text-danger-200 dark:hover:bg-danger-500/25"
              onClick={() => void deleteTransaction()}
              disabled={isSaving}
            >
              Delete transaction
            </button>
          </section>
        </form>
      ) : null}
    </section>
  );
}
