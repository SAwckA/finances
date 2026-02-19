"use client";

import Link from "next/link";
import { type CSSProperties, FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Banknote, Check, ChevronDown, CreditCard, Landmark, Pencil, Trash2 } from "lucide-react";
import { EmptyState, ErrorState, LoadingState } from "@/components/async-state";
import { UiTopBar } from "@/components/ui/ui-top-bar";
import { ApiError } from "@/lib/api-client";
import { ACCOUNT_COLOR_OPTIONS, ACCOUNT_SOURCE_TYPE_TONE } from "@/lib/color-presets";
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

const SOURCE_TYPE_TONE: Record<SourceType, string> = ACCOUNT_SOURCE_TYPE_TONE;

const FORM_ID = "account-editor-form";

const SOURCE_TYPE_OPTIONS: Array<{
  key: SourceType;
  label: string;
  iconValue: string;
  Icon: typeof Landmark;
}> = [
  { key: "bank", label: "Банк", iconValue: "landmark", Icon: Landmark },
  { key: "card", label: "Карта", iconValue: "credit-card", Icon: CreditCard },
  { key: "cash", label: "Наличные", iconValue: "banknote", Icon: Banknote },
];

const DEFAULT_FORM: AccountFormState = {
  sourceType: "bank",
  name: "",
  accountNumber: "",
  initialBalance: "",
  color: ACCOUNT_COLOR_OPTIONS[0],
  currencyCode: "",
};

const FORM_FIELD_SHELL_CLASS =
  "mt-1 flex items-center gap-2 rounded-2xl bg-gradient-to-br from-content2/82 to-content1 px-3 py-2.5 shadow-[var(--shadow-soft)] transition focus-within:shadow-[0_0_0_2px_var(--ring-primary),var(--shadow-strong)]";

const FORM_FIELD_INPUT_CLASS =
  "w-full bg-transparent py-0.5 text-base font-semibold text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] outline-none";
const ACCENT_BUTTON_CLASS =
  "rounded-xl bg-[linear-gradient(135deg,#22d3ee_0%,#06b6d4_55%,#0891b2_100%)] px-3 py-2 text-sm font-semibold text-white shadow-[0_10px_20px_rgba(6,182,212,0.28),inset_0_1px_0_rgba(255,255,255,0.24)] transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring-primary)]";

function selectedGradientStyle(color: string): CSSProperties {
  return {
    backgroundImage: `radial-gradient(circle at 10% 0%, ${toAlphaColor(color, 24)} 0%, transparent 48%), linear-gradient(135deg, ${toAlphaColor(color, 20)} 0%, ${toAlphaColor(color, 10)} 52%, transparent 100%), linear-gradient(135deg, color-mix(in srgb, var(--heroui-content2) 80%, transparent) 0%, color-mix(in srgb, var(--heroui-content1) 100%, transparent) 100%)`,
    boxShadow: `0 0 0 2px ${toAlphaColor(color, 40)}, var(--shadow-soft)`,
  };
}

function toAlphaColor(color: string, opacityPercent: number): string {
  const normalized = Math.max(0, Math.min(100, Math.round(opacityPercent)));
  return `color-mix(in srgb, ${color} ${normalized}%, transparent)`;
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
  const isEditMode = Number.isInteger(parsedEditId) && (parsedEditId as number) > 0;
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

  const closeModal = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("create");
    params.delete("edit");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  const openCreateModal = useCallback(() => {
    router.push(buildHref("create", "1"), { scroll: false });
  }, [buildHref, router]);

  const openEditModal = useCallback(
    (accountId: number) => {
      router.push(buildHref("edit", String(accountId)), { scroll: false });
    },
    [buildHref, router],
  );

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
            description: "Начальный баланс",
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

  if (isModalOpen) {
    return (
      <section className="fixed inset-0 z-50 overscroll-contain bg-[var(--bg-app)]">
        <div className="mx-auto flex h-full w-full max-w-[430px] flex-col">
          <UiTopBar
            title={editingId ? "Редактирование счета" : "Новый счет"}
            onBack={closeModal}
            formId={FORM_ID}
            isSaving={isSubmitting}
            className="border-b-0"
          />
          <div className="flex-1 overflow-y-auto px-3 py-3">
            <form id={FORM_ID} className="app-panel space-y-3 p-3" onSubmit={handleSubmit}>
              <section>
                <p className="mb-1.5 text-sm font-semibold text-[var(--text-secondary)]">Тип счета</p>
                <div className="grid grid-cols-3 gap-2">
                  {SOURCE_TYPE_OPTIONS.map((option) => {
                    const active = form.sourceType === option.key;
                    const tone = SOURCE_TYPE_TONE[option.key];
                    return (
                      <button
                        key={option.key}
                        type="button"
                        className={`interactive-hover rounded-2xl px-2 py-2.5 text-center transition ${
                          active
                            ? "text-[var(--text-primary)]"
                            : "bg-gradient-to-br from-content2/80 to-content1 text-[var(--text-secondary)] shadow-[var(--shadow-soft)]"
                        }`}
                        style={active ? selectedGradientStyle(tone) : undefined}
                        onClick={() =>
                          setForm((prev) => ({
                            ...prev,
                            sourceType: option.key,
                          }))
                        }
                      >
                        <span
                          className="mx-auto inline-flex h-8 w-8 items-center justify-center rounded-xl"
                          style={{ backgroundColor: toAlphaColor(tone, 14), color: tone }}
                        >
                          <option.Icon className="h-4.5 w-4.5" aria-hidden="true" />
                        </span>
                        <p className="mt-1 text-sm font-semibold">{option.label}</p>
                      </button>
                    );
                  })}
                </div>
              </section>

              <label className="block text-sm text-[var(--text-secondary)]">
                Название счета
                <div className={FORM_FIELD_SHELL_CLASS}>
                  <input
                    className={FORM_FIELD_INPUT_CLASS}
                    value={form.name}
                    name="sourceName"
                    autoComplete="off"
                    onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                    placeholder="Введите название счета…"
                    required
                  />
                </div>
              </label>

              <label className="block text-sm text-[var(--text-secondary)]">
                Номер счета (необязательно)
                <div className={FORM_FIELD_SHELL_CLASS}>
                  <input
                    className={FORM_FIELD_INPUT_CLASS}
                    value={form.accountNumber}
                    name="accountNumber"
                    autoComplete="off"
                    onChange={(event) => setForm((prev) => ({ ...prev, accountNumber: event.target.value }))}
                    placeholder="**** **** **** 1234…"
                  />
                </div>
              </label>

              {!editingId ? (
                <label className="block text-sm text-[var(--text-secondary)]">
                  Начальный баланс
                  <div className="mt-1 flex items-center gap-2 rounded-2xl bg-gradient-to-b from-content2/80 to-content1 px-3 py-2.5 shadow-[var(--shadow-soft)]">
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
                Валюта
                <div className={`${FORM_FIELD_SHELL_CLASS} pr-2`}>
                  <select
                    className="w-full appearance-none bg-transparent py-0.5 text-base font-semibold text-[var(--text-primary)] outline-none"
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
                    <option value="">Выберите валюту</option>
                    {currencies.map((currency) => (
                      <option key={currency.code} value={currency.code}>
                        {currency.code} ({currency.symbol})
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="h-4 w-4 shrink-0 text-[var(--text-secondary)]" aria-hidden="true" />
                </div>
              </label>

              <section>
                <p className="mb-1.5 text-sm font-semibold text-[var(--text-secondary)]">Цвет</p>
                <div className="grid grid-cols-6 gap-2">
                  {ACCOUNT_COLOR_OPTIONS.map((color) => {
                    const active = color === form.color;
                    return (
                      <button
                        key={color}
                        type="button"
                        className={`interactive-hover relative h-10 rounded-2xl transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring-primary)] ${
                          active ? "scale-[1.03]" : ""
                        }`}
                        style={{
                          backgroundColor: color,
                          boxShadow: active
                            ? `0 0 0 2px ${toAlphaColor(color, 52)}, var(--shadow-soft)`
                            : "inset 0 1px 0 color-mix(in srgb, white 20%, transparent), var(--shadow-soft)",
                        }}
                        onClick={() => setForm((prev) => ({ ...prev, color }))}
                        aria-label={color}
                      >
                        {active ? (
                          <span className="absolute right-1.5 top-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-[color:color-mix(in_srgb,black_20%,transparent)] text-[var(--text-primary)]">
                            <Check className="h-3 w-3" aria-hidden="true" />
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="rounded-2xl bg-gradient-to-br from-content2/82 to-content1 p-3 shadow-[var(--shadow-soft)]">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-secondary)]">
                  Превью
                </p>
                <div className="rounded-2xl bg-gradient-to-br from-content2/75 to-content1 px-3 py-2.5 shadow-[var(--shadow-soft)]">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span
                        className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-[var(--text-primary)]"
                        style={{ backgroundColor: form.color }}
                      >
                        <PreviewIcon className="h-4.5 w-4.5" aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
                          {form.name.trim() || "Новый счет"}
                        </p>
                        <p className="truncate text-xs text-[var(--text-secondary)]">
                          {shortIdentifierFromAccountNumber(form.accountNumber) ?? "Новый"}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-[var(--text-primary)]">
                        {form.initialBalance ? Number(form.initialBalance).toFixed(2) : "0.00"}
                      </p>
                      <p className="text-xs text-[var(--text-secondary)]">
                        {selectedCurrency?.code ?? "Баланс"}
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              {errorMessage ? <p className="text-sm font-medium text-danger-600">{errorMessage}</p> : null}

              <button
                type="submit"
                className={`w-full ${ACCENT_BUTTON_CLASS} py-2.5 disabled:cursor-not-allowed disabled:opacity-70`}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Сохраняем…" : editingId ? "Сохранить изменения" : "Сохранить"}
              </button>

              {editingId ? (
                <button
                  type="button"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-danger-400/40 bg-danger-500/10 px-3 py-2.5 text-sm font-semibold text-danger-600 transition hover:bg-danger-500/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger-300"
                  onClick={() => void handleDelete(editingId)}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  Удалить счет
                </button>
              ) : null}
            </form>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <section className="app-panel p-3">
        <div className="flex items-center justify-between">
          <h1 className="section-title text-[1.35rem] text-[var(--text-primary)]">Счета</h1>
          <Link
            href="#"
            className={ACCENT_BUTTON_CLASS}
            onClick={(event) => {
              event.preventDefault();
              void openCreateModal();
            }}
          >
            Добавить
          </Link>
        </div>
      </section>

      <section className="motion-stagger space-y-2">
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
                  className="app-panel interactive-hover p-3"
                  style={{
                    backgroundImage: `radial-gradient(circle at 10% 0%, ${toAlphaColor(account.color, 12)} 0%, transparent 42%), linear-gradient(135deg, color-mix(in srgb, var(--bg-card) 96%, transparent) 0%, color-mix(in srgb, var(--bg-card) 100%, transparent) 100%)`,
                  }}
                >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span
                      className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-[var(--text-primary)]"
                      style={{ backgroundColor: account.color }}
                    >
                      <AccountIcon className="h-4.5 w-4.5" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{account.name}</p>
                      {account.short_identifier ? (
                        <span
                          className="mt-1 inline-flex max-w-full items-center rounded-lg bg-[var(--surface-hover)] px-2 py-0.5 text-xs font-semibold"
                          style={{
                            backgroundColor: toAlphaColor(account.color, 14),
                            color: account.color,
                          }}
                        >
                          {account.short_identifier}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <span className="rounded-lg bg-gradient-to-br from-content2/82 to-content1 px-2 py-1 text-xs font-semibold text-[var(--text-secondary)] shadow-[var(--shadow-soft)]">
                      {currency ? `${currency.code} (${currency.symbol})` : "Неизвестная валюта"}
                    </span>
                    <div className="flex gap-2">
                      <Link
                        href="#"
                        className="surface-hover inline-flex items-center gap-1 rounded-lg bg-gradient-to-br from-content2/82 to-content1 px-2.5 py-1.5 text-xs font-semibold text-[var(--text-secondary)] transition shadow-[var(--shadow-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring-primary)]"
                        onClick={(event) => {
                          event.preventDefault();
                          void openEditModal(account.id);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                        Изменить
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
