"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useAuth } from "@/features/auth/auth-context";
import { getIconOption } from "@/lib/icon-catalog";
import type {
  AccountBalanceResponse,
  AccountResponse,
  CategoryResponse,
  CurrencyResponse,
  TransactionType,
} from "@/lib/types";

type TransactionFormFieldsState = {
  accountId: string;
  targetAccountId: string;
  categoryId: string;
  amount: string;
  targetAmount: string;
  description: string;
  transactionDate: string;
};

type TransactionFormFieldsProps = {
  form: TransactionFormFieldsState;
  setForm: React.Dispatch<React.SetStateAction<TransactionFormFieldsState>>;
  transactionType: TransactionType;
  onTypeChange?: (nextType: TransactionType) => void;
  accounts: AccountResponse[];
  accountBalances: AccountBalanceResponse[];
  categories: CategoryResponse[];
  currencies: CurrencyResponse[];
  showTypeSelector?: boolean;
  className?: string;
};

function normalizeAmountInput(value: string): number {
  const normalized = value.replace(",", ".").trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatAmountInput(value: number): string {
  return value.toFixed(2);
}

function shortAccountBadge(account: AccountResponse | null): string | null {
  if (!account?.short_identifier) {
    return null;
  }
  return account.short_identifier;
}

function badgeStyle(color: string | undefined): CSSProperties | undefined {
  if (!color) {
    return undefined;
  }

  return {
    backgroundColor: `${color}1a`,
    borderColor: `${color}55`,
    color,
  };
}

function formatAmount(value: string, currencyCode: string): string {
  const numeric = Number(value);
  if (Number.isNaN(numeric)) {
    return value;
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numeric);
}

export function TransactionFormFields({
  form,
  setForm,
  transactionType,
  onTypeChange,
  accounts,
  accountBalances,
  categories,
  currencies,
  showTypeSelector = false,
  className,
}: TransactionFormFieldsProps) {
  const { authenticatedRequest } = useAuth();
  const selectedAccount = form.accountId
    ? accounts.find((account) => String(account.id) === form.accountId) ?? null
    : null;
  const targetAccount = form.targetAccountId
    ? accounts.find((account) => String(account.id) === form.targetAccountId) ?? null
    : null;
  const selectedCurrency = selectedAccount
    ? currencies.find((currency) => currency.code === selectedAccount.currency_code) ?? null
    : null;
  const targetCurrency = targetAccount
    ? currencies.find((currency) => currency.code === targetAccount.currency_code) ?? null
    : null;
  const sameCurrency =
    Boolean(selectedCurrency && targetCurrency) &&
    selectedCurrency?.code === targetCurrency?.code;
  const formCategories =
    transactionType === "transfer"
      ? []
      : categories.filter((category) => category.type === transactionType);
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  const [isRateLoading, setIsRateLoading] = useState(false);
  const [lastEdited, setLastEdited] = useState<"source" | "target">("source");
  const [showTransferDelta, setShowTransferDelta] = useState(false);
  const transferAccountsRef = useRef({ accountId: "", targetAccountId: "" });
  const transferInitializedRef = useRef(false);
  const sourceAmount = normalizeAmountInput(form.amount);
  const targetAmount = normalizeAmountInput(form.targetAmount);
  const hasTargetOverride = form.targetAmount !== "" && targetAmount !== sourceAmount;
  const showTargetAmount =
    transactionType === "transfer" && targetAccount && (!sameCurrency || showTransferDelta);
  const derivedRate =
    sourceAmount > 0 && targetAmount > 0 ? targetAmount / sourceAmount : null;
  const effectiveRate =
    lastEdited === "target" && derivedRate ? derivedRate : exchangeRate ?? derivedRate;
  const percentDelta =
    sourceAmount > 0 && targetAmount > 0 ? ((targetAmount - sourceAmount) / sourceAmount) * 100 : null;

  useEffect(() => {
    if (transactionType !== "transfer" || !selectedCurrency || !targetCurrency) {
      setExchangeRate(null);
      return;
    }
    if (sameCurrency) {
      setExchangeRate(1);
      return;
    }

    let active = true;
    const loadRate = async () => {
      setIsRateLoading(true);
      try {
        const response = await authenticatedRequest<{ rate: string | number }>(
          `/api/currencies/rate?from_currency=${selectedCurrency.code}&to_currency=${targetCurrency.code}`,
        );
        if (active) {
          setExchangeRate(Number(response.rate));
        }
      } catch {
        if (active) {
          setExchangeRate(null);
        }
      } finally {
        if (active) {
          setIsRateLoading(false);
        }
      }
    };

    void loadRate();
    return () => {
      active = false;
    };
  }, [authenticatedRequest, sameCurrency, selectedCurrency, targetCurrency, transactionType]);

  useEffect(() => {
    if (transactionType !== "transfer") {
      return;
    }
    if (!transferInitializedRef.current) {
      transferInitializedRef.current = true;
      transferAccountsRef.current = {
        accountId: form.accountId,
        targetAccountId: form.targetAccountId,
      };
      return;
    }
    const prev = transferAccountsRef.current;
    if (prev.accountId === form.accountId && prev.targetAccountId === form.targetAccountId) {
      return;
    }
    transferAccountsRef.current = {
      accountId: form.accountId,
      targetAccountId: form.targetAccountId,
    };
    setLastEdited("source");
    setShowTransferDelta(false);
    setForm((prevForm) => ({ ...prevForm, targetAmount: "" }));
  }, [form.accountId, form.targetAccountId, setForm, transactionType]);

  useEffect(() => {
    if (transactionType !== "transfer") {
      return;
    }
    if (sameCurrency && hasTargetOverride && !showTransferDelta) {
      setShowTransferDelta(true);
    }
  }, [hasTargetOverride, sameCurrency, showTransferDelta, transactionType]);

  useEffect(() => {
    if (!showTargetAmount || lastEdited !== "source") {
      return;
    }
    if (!sourceAmount || !effectiveRate) {
      return;
    }
    const next = formatAmountInput(sourceAmount * effectiveRate);
    if (next !== form.targetAmount) {
      setForm((prev) => ({ ...prev, targetAmount: next }));
    }
  }, [effectiveRate, form.targetAmount, lastEdited, setForm, showTargetAmount, sourceAmount]);

  return (
    <div className={className ?? ""}>
      {showTypeSelector ? (
        <SegmentedControl
          options={[
            { key: "expense", label: "Expense" },
            { key: "income", label: "Income" },
            { key: "transfer", label: "Transfer" },
          ]}
          value={transactionType}
          onChange={(nextType) => onTypeChange?.(nextType)}
        />
      ) : null}

      <div className="mt-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-[var(--text-secondary)]">Amount</span>
          <span className="badge">
            {selectedCurrency ? `${selectedCurrency.code} ${selectedCurrency.symbol}` : "Currency"}
          </span>
        </div>

        <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[var(--bg-card)] p-3 transition focus-within:shadow-[0_0_0_3px_var(--ring-primary)]">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)]">
              Total
            </span>
            <div className="h-px flex-1 bg-[color:var(--border-soft)]" />
            <button
              type="button"
              className="text-xs font-semibold text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]"
              onClick={() => setForm((prev) => ({ ...prev, amount: "" }))}
            >
              Clear
            </button>
          </div>

          <div className="mt-3 flex items-end gap-2">
            <input
              className="w-full bg-transparent text-3xl font-extrabold tracking-tight text-[var(--text-primary)] outline-none"
              inputMode="decimal"
              name="amount"
              autoComplete="off"
              placeholder="0.00…"
              value={form.amount}
              onChange={(event) => {
                setLastEdited("source");
                setForm((prev) => ({ ...prev, amount: event.target.value }));
              }}
              required
            />
            <span className="text-sm font-semibold text-[var(--text-secondary)]">
              {selectedCurrency?.symbol ?? ""}
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[var(--bg-card)]/70 p-1.5">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1.5">
            <div className="flex flex-wrap items-center justify-start gap-1.5">
              {[-100, -25, -5].map((value) => (
                <button
                  key={value}
                  type="button"
                  className="surface-hover rounded-full border border-[color:var(--border-soft)] px-2.5 py-0.5 text-[11px] font-semibold text-rose-600 transition"
                  onClick={() =>
                    setForm((prev) => {
                      const current = normalizeAmountInput(prev.amount);
                      const next = Math.max(0, current + value);
                      return { ...prev, amount: formatAmountInput(next) };
                    })
                  }
                >
                  {value}
                </button>
              ))}
            </div>
            <div className="flex flex-col items-center gap-1 text-[9px] font-semibold uppercase tracking-[0.24em] text-[var(--text-secondary)]">
              <span>±</span>
              <span className="h-5 w-px bg-[color:var(--border-soft)]" />
            </div>
            <div className="flex flex-wrap items-center justify-end gap-1.5">
              {[5, 25, 100].map((value) => (
                <button
                  key={value}
                  type="button"
                  className="surface-hover rounded-full border border-[color:var(--border-soft)] px-2.5 py-0.5 text-[11px] font-semibold text-emerald-600 transition"
                  onClick={() =>
                    setForm((prev) => {
                      const current = normalizeAmountInput(prev.amount);
                      return { ...prev, amount: formatAmountInput(current + value) };
                    })
                  }
                >
                  +{value}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <section className="mt-3">
        <p className="mb-1.5 text-base font-semibold text-slate-700">Payment Source</p>
        <div className="grid grid-cols-2 gap-2">
          {accounts.map((account) => {
            const selected = String(account.id) === form.accountId;
            const Icon = getIconOption(account.icon).icon;
            const badge = shortAccountBadge(account);
            const balance = accountBalances.find((item) => item.account_id === account.id);
            return (
              <button
                key={account.id}
                type="button"
                className={`flex items-center gap-2 rounded-2xl border px-3 py-2.5 text-left transition ${
                  selected
                    ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/10"
                    : "border-[color:var(--border-soft)] bg-[var(--bg-card)]"
                }`}
                onClick={() =>
                  setForm((prev) => ({
                    ...prev,
                    accountId: String(account.id),
                  }))
                }
              >
                <span
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl"
                  style={{ backgroundColor: `${account.color}22`, color: account.color }}
                >
                  <Icon className="h-4.5 w-4.5" />
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-xs font-semibold text-[var(--text-primary)]">
                      {account.name}
                    </span>
                    {badge ? (
                      <span className="badge" style={badgeStyle(account.color)}>
                        {badge}
                      </span>
                    ) : (
                      <span className="text-xs text-[var(--text-secondary)]">No ID</span>
                    )}
                  </div>
                  <span className="mt-1 block text-xs text-[var(--text-secondary)]">
                    {balance ? formatAmount(balance.balance, balance.currency_code) : "Balance unknown"}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {transactionType === "transfer" ? (
        <section className="mt-3">
          <p className="mb-1.5 text-base font-semibold text-slate-700">Target Source</p>
          <div className="grid grid-cols-2 gap-2">
            {accounts
              .filter((account) => String(account.id) !== form.accountId)
              .map((account) => {
                const selected = String(account.id) === form.targetAccountId;
                const Icon = getIconOption(account.icon).icon;
                const badge = shortAccountBadge(account);
                const balance = accountBalances.find((item) => item.account_id === account.id);
                return (
                  <button
                    key={account.id}
                    type="button"
                    className={`flex items-center gap-2 rounded-2xl border px-3 py-2.5 text-left transition ${
                      selected
                        ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/10"
                        : "border-[color:var(--border-soft)] bg-[var(--bg-card)]"
                    }`}
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        targetAccountId: String(account.id),
                      }))
                    }
                  >
                    <span
                      className="inline-flex h-9 w-9 items-center justify-center rounded-xl"
                      style={{ backgroundColor: `${account.color}22`, color: account.color }}
                    >
                      <Icon className="h-4.5 w-4.5" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-xs font-semibold text-[var(--text-primary)]">
                          {account.name}
                        </span>
                        {badge ? (
                          <span className="badge" style={badgeStyle(account.color)}>
                            {badge}
                          </span>
                        ) : (
                          <span className="text-xs text-[var(--text-secondary)]">No ID</span>
                        )}
                      </div>
                      <span className="mt-1 block text-xs text-[var(--text-secondary)]">
                        {balance
                          ? formatAmount(balance.balance, balance.currency_code)
                          : "Balance unknown"}
                      </span>
                    </div>
                  </button>
                );
            })}
          </div>
        </section>
      ) : (
        <section className="mt-3">
          <p className="mb-1.5 text-base font-semibold text-slate-700">Category</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className={`flex items-center gap-2 rounded-2xl border px-3 py-2.5 text-left transition ${
                form.categoryId === ""
                  ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/10"
                  : "border-[color:var(--border-soft)] bg-[var(--bg-card)]"
              }`}
              onClick={() => setForm((prev) => ({ ...prev, categoryId: "" }))}
            >
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--surface-hover)] text-[var(--text-secondary)]">
                <span className="text-xs font-semibold">—</span>
              </span>
              <span className="text-sm font-semibold text-[var(--text-primary)]">
                Without category
              </span>
            </button>
            {formCategories.map((category) => {
              const selected = String(category.id) === form.categoryId;
              const Icon = getIconOption(category.icon).icon;
              return (
                <button
                  key={category.id}
                  type="button"
                  className={`flex items-center gap-2 rounded-2xl border px-3 py-2.5 text-left transition ${
                    selected
                      ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/10"
                      : "border-[color:var(--border-soft)] bg-[var(--bg-card)]"
                  }`}
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      categoryId: String(category.id),
                    }))
                  }
                >
                  <span
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl"
                    style={{ backgroundColor: `${category.color}22`, color: category.color }}
                  >
                    <Icon className="h-4.5 w-4.5" />
                  </span>
                  <span className="text-sm font-semibold text-[var(--text-primary)]">
                    {category.name}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {transactionType === "transfer" && targetAccount ? (
        <section className="mt-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-[var(--text-secondary)]">You receive</span>
            <span className="badge">
              {targetCurrency ? `${targetCurrency.code} ${targetCurrency.symbol}` : "Currency"}
            </span>
          </div>
          {sameCurrency ? (
            <button
              type="button"
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring-primary)] ${
                showTransferDelta
                  ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]"
                  : "border-[color:var(--border-soft)] bg-[var(--bg-card)] text-[var(--text-secondary)]"
              }`}
              onClick={() => {
                setShowTransferDelta((prev) => !prev);
                if (showTransferDelta) {
                  setForm((prev) => ({ ...prev, targetAmount: "" }));
                } else {
                  setLastEdited("source");
                  if (form.amount) {
                    setForm((prev) => ({ ...prev, targetAmount: prev.amount }));
                  }
                }
              }}
            >
              Amounts differ
            </button>
          ) : null}
          {showTargetAmount ? (
            <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[var(--bg-card)] p-3 transition focus-within:shadow-[0_0_0_3px_var(--ring-primary)]">
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)]">
                  Receive
                </span>
                <div className="h-px flex-1 bg-[color:var(--border-soft)]" />
                {isRateLoading ? (
                  <span className="text-xs text-[var(--text-secondary)]">Loading…</span>
                ) : null}
              </div>
              <div className="mt-3 flex items-end gap-2">
                <input
                  className="w-full bg-transparent text-3xl font-extrabold tracking-tight text-[var(--text-primary)] outline-none"
                  inputMode="decimal"
                  name="targetAmount"
                  autoComplete="off"
                  placeholder="0.00…"
                  value={form.targetAmount}
                  onChange={(event) => {
                    setLastEdited("target");
                    setForm((prev) => ({ ...prev, targetAmount: event.target.value }));
                  }}
                  required={!sameCurrency}
                />
                <span className="text-sm font-semibold text-[var(--text-secondary)]">
                  {targetCurrency?.symbol ?? ""}
                </span>
              </div>
              {effectiveRate ? (
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[var(--text-secondary)]">
                  <span className="badge">
                    Rate {selectedCurrency?.code} → {targetCurrency?.code}
                  </span>
                  <span>
                    1 {selectedCurrency?.code} = {effectiveRate.toFixed(6)} {targetCurrency?.code}
                  </span>
                  {sameCurrency && percentDelta !== null ? (
                    <span className="badge" style={badgeStyle("#0EA5E9")}>
                      {percentDelta >= 0 ? "+" : ""}
                      {percentDelta.toFixed(2)}%
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}

      <label className="mt-3 block text-sm text-slate-700">
        Description (Optional)
        <input
          className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
          value={form.description}
          onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
        />
      </label>

      <label className="mt-3 block text-sm text-slate-700">
        Date and time
        <input
          className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
          type="datetime-local"
          value={form.transactionDate}
          onChange={(event) =>
            setForm((prev) => ({ ...prev, transactionDate: event.target.value }))
          }
        />
      </label>
    </div>
  );
}
