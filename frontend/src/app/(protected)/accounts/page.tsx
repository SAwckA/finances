"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Banknote, CreditCard, Landmark, Pencil, Trash2 } from "lucide-react";
import { EmptyState, ErrorState, LoadingState } from "@/components/async-state";
import { TransactionEditorHeader } from "@/components/transactions/transaction-editor-header";
import { ApiError } from "@/lib/api-client";
import { getIconOption } from "@/lib/icon-catalog";
import { useAuth } from "@/features/auth/auth-context";
import type {
  AccountCreate,
  AccountResponse,
  AccountUpdate,
  CurrencyResponse,
  TransactionCreate,
} from "@/lib/types";

type SourceType = "bank" | "card" | "cash";

type AccountFormState = {
  sourceType: SourceType;
  name: string;
  accountNumber: string;
  initialBalance: string;
  color: string;
  currencyCode: string;
};

const FORM_ID = "account-editor-form";

const ACCOUNT_COLOR_OPTIONS = [
  "#4F7EF6",
  "#5ABB66",
  "#E0534A",
  "#8E5BE8",
  "#E77F2E",
  "#D65497",
  "#57B6AE",
  "#5B62DC",
  "#E0B43F",
  "#56B883",
  "#64748B",
  "#DF4D5E",
];

const SOURCE_TYPE_OPTIONS: Array<{
  key: SourceType;
  label: string;
  iconValue: string;
  Icon: typeof Landmark;
}> = [
  { key: "bank", label: "Bank", iconValue: "landmark", Icon: Landmark },
  { key: "card", label: "Card", iconValue: "credit-card", Icon: CreditCard },
  { key: "cash", label: "Cash", iconValue: "banknote", Icon: Banknote },
];

const DEFAULT_FORM: AccountFormState = {
  sourceType: "bank",
  name: "",
  accountNumber: "",
  initialBalance: "",
  color: "#4F7EF6",
  currencyCode: "",
};

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

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return `Ошибка API (${error.status}). Проверьте данные и попробуйте снова.`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Что-то пошло не так. Попробуйте снова.";
}

function sourceTypeFromIcon(iconValue: string): SourceType {
  if (iconValue === "credit-card") {
    return "card";
  }
  if (iconValue === "banknote") {
    return "cash";
  }
  return "bank";
}

function shortIdentifierFromAccountNumber(accountNumber: string): string | null {
  const digits = accountNumber.replace(/\D/g, "");
  if (!digits.length) {
    return null;
  }
  return digits.slice(-4);
}

export default function AccountsPage() {
  const { authenticatedRequest } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [accounts, setAccounts] = useState<AccountResponse[]>([]);
  const [currencies, setCurrencies] = useState<CurrencyResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [form, setForm] = useState<AccountFormState>(DEFAULT_FORM);

  const createParam = searchParams.get("create");
  const editParam = searchParams.get("edit");
  const isCreateMode = createParam === "1" || createParam === "true";
  const parsedEditId = editParam ? Number(editParam) : null;
  const isEditMode = Number.isFinite(parsedEditId ?? Number.NaN);
  const editingId = isEditMode ? (parsedEditId as number) : null;
  const isModalOpen = isCreateMode || isEditMode;

  const currencyById = useMemo(
    () => new Map(currencies.map((currency) => [currency.code, currency])),
    [currencies],
  );

  const selectedSource = SOURCE_TYPE_OPTIONS.find((option) => option.key === form.sourceType) ?? SOURCE_TYPE_OPTIONS[0];
  const PreviewIcon = selectedSource.Icon;
  const selectedCurrency = form.currencyCode ? currencyById.get(form.currencyCode) : null;

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const [accountsData, currenciesData] = await Promise.all([
        authenticatedRequest<AccountResponse[]>("/api/accounts?skip=0&limit=300"),
        authenticatedRequest<CurrencyResponse[]>("/api/currencies?skip=0&limit=300"),
      ]);
      setAccounts(accountsData);
      setCurrencies(currenciesData);
      if (!form.currencyCode && currenciesData[0]) {
        setForm((prev) => ({ ...prev, currencyCode: currenciesData[0].code }));
      }
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, [authenticatedRequest, form.currencyCode]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const resetForm = useCallback(() => {
    setForm((prev) => ({
      ...DEFAULT_FORM,
      currencyCode: prev.currencyCode || (currencies[0] ? currencies[0].code : ""),
    }));
  }, [currencies]);

  useEffect(() => {
    if (!isModalOpen) {
      return;
    }

    if (isCreateMode) {
      resetForm();
      return;
    }

    if (!editingId) {
      return;
    }

    const account = accounts.find((item) => item.id === editingId);
    if (!account) {
      return;
    }

    setForm({
      sourceType: sourceTypeFromIcon(account.icon),
      name: account.name,
      accountNumber: account.short_identifier ?? "",
      initialBalance: "",
      color: account.color,
      currencyCode: String(account.currency_code),
    });
  }, [accounts, editingId, isCreateMode, isModalOpen, resetForm]);

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

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!form.name.trim() || !form.currencyCode || !form.color) {
      setErrorMessage("Заполните обязательные поля.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const payload: AccountCreate | AccountUpdate = {
      name: form.name.trim(),
      color: form.color,
      icon: selectedSource.iconValue,
      currency_code: form.currencyCode,
      short_identifier: shortIdentifierFromAccountNumber(form.accountNumber),
    };

    try {
      if (editingId) {
        await authenticatedRequest(`/api/accounts/${editingId}`, { method: "PATCH", body: payload });
      } else {
        const createdAccount = await authenticatedRequest<AccountResponse>("/api/accounts", {
          method: "POST",
          body: payload,
        });

        const initialBalance = Number(form.initialBalance);
        if (Number.isFinite(initialBalance) && initialBalance > 0) {
          const initialTx: TransactionCreate = {
            type: "income",
            account_id: createdAccount.id,
            amount: initialBalance,
            description: "Initial balance",
            transaction_date: new Date().toISOString(),
            category_id: null,
            target_account_id: null,
          };
          try {
            await authenticatedRequest("/api/transactions", {
              method: "POST",
              body: initialTx,
            });
          } catch {
            setErrorMessage("Счет создан, но стартовый баланс добавить не удалось.");
          }
        }
      }

      await loadData();
      closeModal();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (accountId: number) => {
    const confirmed = window.confirm("Удалить счет?");
    if (!confirmed) {
      return;
    }

    setErrorMessage(null);
    try {
      await authenticatedRequest(`/api/accounts/${accountId}`, { method: "DELETE" });
      if (editingId === accountId) {
        closeModal();
      }
      await loadData();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  };

  return (
    <section className="space-y-3">
      {isModalOpen ? (
        <section className="fixed inset-0 z-50 overscroll-contain bg-[var(--bg-app)]">
          <div className="mx-auto flex h-full w-full max-w-[430px] flex-col">
            <TransactionEditorHeader
              title={editingId ? "Edit Account" : "New Account"}
              onBack={closeModal}
              formId={FORM_ID}
              isSaving={isSubmitting}
            />
            <div className="flex-1 overflow-y-auto px-3 py-3">
              <form id={FORM_ID} className="app-panel space-y-3 p-3" onSubmit={handleSubmit}>
                <section>
                  <p className="mb-1.5 text-sm font-semibold text-[var(--text-secondary)]">Source Type</p>
                  <div className="grid grid-cols-3 gap-2">
                    {SOURCE_TYPE_OPTIONS.map((option) => {
                      const active = form.sourceType === option.key;
                      return (
                        <button
                          key={option.key}
                          type="button"
                          className={`rounded-2xl border px-2 py-2.5 text-center transition ${
                            active
                              ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]"
                              : "border-[color:var(--border-soft)] bg-[var(--bg-card)] text-[var(--text-secondary)]"
                          }`}
                          onClick={() =>
                            setForm((prev) => ({
                              ...prev,
                              sourceType: option.key,
                            }))
                          }
                        >
                          <option.Icon className="mx-auto h-4.5 w-4.5" aria-hidden="true" />
                          <p className="mt-1 text-sm font-semibold">{option.label}</p>
                        </button>
                      );
                    })}
                  </div>
                </section>

                <label className="block text-sm text-[var(--text-secondary)]">
                  Source Name
                  <input
                    className="mt-1 block w-full rounded-xl border border-[color:var(--border-soft)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none transition focus-visible:ring-2 focus-visible:ring-[var(--ring-primary)]"
                    value={form.name}
                    name="sourceName"
                    autoComplete="off"
                    onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                    placeholder="Enter source name…"
                    required
                  />
                </label>

                <label className="block text-sm text-[var(--text-secondary)]">
                  Account Number (Optional)
                  <input
                    className="mt-1 block w-full rounded-xl border border-[color:var(--border-soft)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none transition focus-visible:ring-2 focus-visible:ring-[var(--ring-primary)]"
                    value={form.accountNumber}
                    name="accountNumber"
                    autoComplete="off"
                    onChange={(event) => setForm((prev) => ({ ...prev, accountNumber: event.target.value }))}
                    placeholder="**** **** **** 1234…"
                  />
                </label>

                {!editingId ? (
                  <label className="block text-sm text-[var(--text-secondary)]">
                    Initial Balance
                    <div className="mt-1 flex items-center gap-2 rounded-xl border border-[color:var(--border-soft)] bg-[var(--bg-card)] px-3 py-2">
                      <span className="text-lg font-semibold text-[var(--text-secondary)]">
                        {selectedCurrency?.symbol ?? "$"}
                      </span>
                      <input
                        className="w-full border-none bg-transparent text-2xl font-bold text-[var(--text-primary)] outline-none"
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        min="0"
                        name="initialBalance"
                        autoComplete="off"
                        value={form.initialBalance}
                        onChange={(event) =>
                          setForm((prev) => ({
                            ...prev,
                            initialBalance: event.target.value,
                          }))
                        }
                        placeholder="0.00…"
                      />
                    </div>
                  </label>
                ) : null}

                <label className="block text-sm text-[var(--text-secondary)]">
                  Currency
                  <select
                    className="mt-1 block w-full rounded-xl border border-[color:var(--border-soft)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none transition focus-visible:ring-2 focus-visible:ring-[var(--ring-primary)]"
                    value={form.currencyCode}
                    name="currencyCode"
                    autoComplete="off"
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        currencyCode: event.target.value,
                      }))
                    }
                    required
                  >
                    <option value="">Select currency</option>
                    {currencies.map((currency) => (
                      <option key={currency.code} value={currency.code}>
                        {currency.code} ({currency.symbol})
                      </option>
                    ))}
                  </select>
                </label>

                <section>
                  <p className="mb-1.5 text-sm font-semibold text-[var(--text-secondary)]">Choose Color</p>
                  <div className="grid grid-cols-6 gap-2">
                    {ACCOUNT_COLOR_OPTIONS.map((color) => {
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
                          className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-white"
                          style={{ backgroundColor: form.color }}
                        >
                          <PreviewIcon className="h-4.5 w-4.5" aria-hidden="true" />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
                            {form.name.trim() || "Payment Source"}
                          </p>
                          <p className="truncate text-xs text-[var(--text-secondary)]">
                            {shortIdentifierFromAccountNumber(form.accountNumber) ?? "New source"}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-[var(--text-primary)]">
                          {form.initialBalance ? Number(form.initialBalance).toFixed(2) : "0.00"}
                        </p>
                        <p className="text-xs text-[var(--text-secondary)]">
                          {selectedCurrency?.code ?? "Balance"}
                        </p>
                      </div>
                    </div>
                  </div>
                </section>

                {errorMessage ? <p className="text-sm font-medium text-danger-600">{errorMessage}</p> : null}

                <button
                  type="submit"
                  className="w-full rounded-xl bg-[var(--accent-primary)] px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--accent-primary-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring-primary)] disabled:cursor-not-allowed disabled:opacity-70"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Saving…" : editingId ? "Save Changes" : "Save"}
                </button>

                {editingId ? (
                  <button
                    type="button"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-danger-400/40 bg-danger-500/10 px-3 py-2.5 text-sm font-semibold text-danger-600 transition hover:bg-danger-500/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger-300"
                    onClick={() => void handleDelete(editingId)}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    Delete Account
                  </button>
                ) : null}
              </form>
            </div>
          </div>
        </section>
      ) : null}

      <section className="app-panel p-3">
        <div className="flex items-center justify-between">
          <h1 className="section-title text-[1.35rem] text-[var(--text-primary)]">Payment Sources</h1>
          <Link
            href={buildHref("create", "1")}
            scroll={false}
            className="rounded-xl bg-[var(--accent-primary)] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent-primary-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring-primary)]"
          >
            New
          </Link>
        </div>
      </section>

      <section className="space-y-2">
        {errorMessage ? <ErrorState message={errorMessage} /> : null}
                {isLoading ? <LoadingState message="Загружаем счета…" /> : null}
        {!isLoading && accounts.length === 0 ? <EmptyState message="Счета еще не добавлены." /> : null}

        {!isLoading
          ? accounts.map((account) => {
              const currency = currencyById.get(account.currency_code);
              const iconOption = getIconOption(account.icon);
              const AccountIcon = iconOption.icon;
              return (
                <article
                  key={account.id}
                  className="app-panel p-3"
                  style={{ backgroundColor: toSoftBackground(account.color, 0.12) }}
                >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span
                      className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-white"
                      style={{ backgroundColor: account.color }}
                    >
                      <AccountIcon className="h-4.5 w-4.5" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{account.name}</p>
                      {account.short_identifier ? (
                        <span
                          className="mt-1 inline-flex max-w-full items-center rounded-lg border px-2 py-0.5 text-xs font-semibold"
                          style={{
                            backgroundColor: `${account.color}22`,
                            borderColor: `${account.color}55`,
                            color: account.color,
                          }}
                        >
                          {account.short_identifier}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <span className="rounded-lg border border-[color:var(--border-soft)] bg-[var(--bg-card)] px-2 py-1 text-xs font-semibold text-[var(--text-secondary)]">
                      {currency ? `${currency.code} (${currency.symbol})` : "Unknown currency"}
                    </span>
                    <div className="flex gap-2">
                      <Link
                        href={buildHref("edit", String(account.id))}
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
