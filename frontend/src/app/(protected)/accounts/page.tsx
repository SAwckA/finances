"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Banknote, CreditCard, Landmark, Pencil, Trash2 } from "lucide-react";
import { EmptyState, LoadingState } from "@/components/async-state";
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
  currencyId: string;
};

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
  currencyId: "",
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
  const [accounts, setAccounts] = useState<AccountResponse[]>([]);
  const [currencies, setCurrencies] = useState<CurrencyResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<AccountFormState>(DEFAULT_FORM);

  const currencyById = useMemo(
    () => new Map(currencies.map((currency) => [currency.id, currency])),
    [currencies],
  );

  const selectedSource = SOURCE_TYPE_OPTIONS.find((option) => option.key === form.sourceType) ?? SOURCE_TYPE_OPTIONS[0];
  const PreviewIcon = selectedSource.Icon;
  const selectedCurrency = form.currencyId ? currencyById.get(Number(form.currencyId)) : null;

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
      if (!form.currencyId && currenciesData[0]) {
        setForm((prev) => ({ ...prev, currencyId: String(currenciesData[0].id) }));
      }
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, [authenticatedRequest, form.currencyId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const resetForm = useCallback(() => {
    setEditingId(null);
    setForm((prev) => ({
      ...DEFAULT_FORM,
      currencyId: prev.currencyId || (currencies[0] ? String(currencies[0].id) : ""),
    }));
  }, [currencies]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!form.name.trim() || !form.currencyId || !form.color) {
      setErrorMessage("Заполните обязательные поля.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const payload: AccountCreate | AccountUpdate = {
      name: form.name.trim(),
      color: form.color,
      icon: selectedSource.iconValue,
      currency_id: Number(form.currencyId),
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

      resetForm();
      await loadData();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (account: AccountResponse) => {
    setEditingId(account.id);
    setForm({
      sourceType: sourceTypeFromIcon(account.icon),
      name: account.name,
      accountNumber: account.short_identifier ?? "",
      initialBalance: "",
      color: account.color,
      currencyId: String(account.currency_id),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
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
          <h1 className="section-title text-[1.35rem]">
            {editingId ? "Edit Payment Source" : "New Payment Source"}
          </h1>
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
          <p className="mb-1.5 text-base font-semibold text-slate-700">Source Type</p>
          <div className="grid grid-cols-3 gap-2">
            {SOURCE_TYPE_OPTIONS.map((option) => {
              const active = form.sourceType === option.key;
              return (
                <button
                  key={option.key}
                  type="button"
                  className={`rounded-2xl border px-2 py-2.5 text-center ${
                    active
                      ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]"
                      : "border-slate-200 bg-white text-slate-600"
                  }`}
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      sourceType: option.key,
                    }))
                  }
                >
                  <option.Icon className="mx-auto h-4.5 w-4.5" />
                  <p className="mt-1 text-sm font-semibold">{option.label}</p>
                </button>
              );
            })}
          </div>
        </section>

        <label className="block text-sm text-slate-700">
          Source Name
          <input
            className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            placeholder="Enter source name"
            required
          />
        </label>

        <label className="block text-sm text-slate-700">
          Account Number (Optional)
          <input
            className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            value={form.accountNumber}
            onChange={(event) => setForm((prev) => ({ ...prev, accountNumber: event.target.value }))}
            placeholder="**** **** **** 1234"
          />
        </label>

        {!editingId ? (
          <label className="block text-sm text-slate-700">
            Initial Balance
            <div className="mt-1 flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2">
              <span className="text-lg font-semibold text-slate-500">
                {selectedCurrency?.symbol ?? "$"}
              </span>
              <input
                className="w-full border-none bg-transparent text-2xl font-bold text-slate-500 outline-none"
                type="number"
                step="0.01"
                min="0"
                value={form.initialBalance}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    initialBalance: event.target.value,
                  }))
                }
                placeholder="0.00"
              />
            </div>
          </label>
        ) : null}

        <label className="block text-sm text-slate-700">
          Currency
          <select
            className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            value={form.currencyId}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                currencyId: event.target.value,
              }))
            }
            required
          >
            <option value="">Select currency</option>
            {currencies.map((currency) => (
              <option key={currency.id} value={currency.id}>
                {currency.code} ({currency.symbol})
              </option>
            ))}
          </select>
        </label>

        <section>
          <p className="mb-1.5 text-base font-semibold text-slate-700">Choose Color</p>
          <div className="grid grid-cols-6 gap-2">
            {ACCOUNT_COLOR_OPTIONS.map((color) => {
              const active = color === form.color;
              return (
                <button
                  key={color}
                  type="button"
                  className={`h-10 rounded-xl border-2 transition ${active ? "border-slate-700" : "border-transparent"}`}
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
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-white"
                  style={{ backgroundColor: form.color }}
                >
                  <PreviewIcon className="h-4.5 w-4.5" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-800">
                    {form.name.trim() || "Payment Source"}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {shortIdentifierFromAccountNumber(form.accountNumber)
                      ? `**** ${shortIdentifierFromAccountNumber(form.accountNumber)}`
                      : "New source"}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-slate-800">
                  {form.initialBalance ? Number(form.initialBalance).toFixed(2) : "0.00"}
                </p>
                <p className="text-xs text-slate-500">
                  {selectedCurrency?.code ?? "Balance"}
                </p>
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
          {isSubmitting ? "Saving..." : editingId ? "Save Changes" : "Save"}
        </button>
      </form>

      <section className="space-y-2">
        {isLoading ? <LoadingState message="Загружаем счета..." /> : null}
        {!isLoading && accounts.length === 0 ? <EmptyState message="Счета еще не добавлены." /> : null}

        {!isLoading
          ? accounts.map((account) => {
              const currency = currencyById.get(account.currency_id);
              const iconOption = getIconOption(account.icon);
              const AccountIcon = iconOption.icon;
              return (
                <article
                  key={account.id}
                  className="mobile-card p-3"
                  style={{ backgroundColor: toSoftBackground(account.color, 0.12) }}
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span
                        className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-white"
                        style={{ backgroundColor: account.color }}
                      >
                        <AccountIcon className="h-4.5 w-4.5" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-800">{account.name}</p>
                        <p className="truncate text-xs text-slate-500">
                          {currency ? `${currency.code} (${currency.symbol})` : "Unknown currency"}
                        </p>
                      </div>
                    </div>
                    {account.short_identifier ? (
                      <span className="rounded-lg bg-white/70 px-2 py-1 text-xs font-semibold text-slate-700">
                        **** {account.short_identifier}
                      </span>
                    ) : null}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-lg bg-white/80 px-2.5 py-1.5 text-xs font-semibold text-slate-700"
                      onClick={() => handleEdit(account)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </button>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-lg bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700"
                      onClick={() => void handleDelete(account.id)}
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
