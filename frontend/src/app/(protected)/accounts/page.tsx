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
import type {
  AccountCreate,
  AccountResponse,
  AccountUpdate,
  CurrencyResponse,
} from "@/lib/types";

type AccountFormState = {
  name: string;
  color: string;
  icon: string;
  currencyId: string;
  shortIdentifier: string;
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

const DEFAULT_FORM: AccountFormState = {
  name: "",
  color: "#2563EB",
  icon: "wallet",
  currencyId: "",
  shortIdentifier: "",
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

  const resetForm = () => {
    setForm(DEFAULT_FORM);
    setEditingId(null);
  };

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const [accountsData, currenciesData] = await Promise.all([
        authenticatedRequest<AccountResponse[]>("/api/accounts"),
        authenticatedRequest<CurrencyResponse[]>("/api/currencies"),
      ]);
      setAccounts(accountsData);
      setCurrencies(currenciesData);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, [authenticatedRequest]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!form.name || !form.color || !form.icon || !form.currencyId) {
      setErrorMessage("Заполните обязательные поля.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const payload: AccountCreate | AccountUpdate = {
      name: form.name.trim(),
      color: form.color.trim(),
      icon: form.icon.trim(),
      currency_id: Number(form.currencyId),
      short_identifier: form.shortIdentifier.trim() || null,
    };

    try {
      if (editingId) {
        await authenticatedRequest(`/api/accounts/${editingId}`, {
          method: "PATCH",
          body: payload,
        });
      } else {
        await authenticatedRequest("/api/accounts", { method: "POST", body: payload });
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
      name: account.name,
      color: account.color,
      icon: account.icon,
      currencyId: String(account.currency_id),
      shortIdentifier: account.short_identifier ?? "",
    });
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
    <>
      <ScreenHeader
        title="Счета"
        description="Управление счетами: карты, наличные и другие источники хранения средств."
      />
      <section className="mb-4 rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-base font-semibold text-slate-900">
          {editingId ? "Редактировать счет" : "Новый счет"}
        </h2>
        <form className="space-y-2.5" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <Input
              label="Название"
              isRequired
              value={form.name}
              onValueChange={(value) => setForm((prev) => ({ ...prev, name: value }))}
            />
            <Input
              label="Короткий идентификатор"
              description="Например: 4421"
              value={form.shortIdentifier}
              onValueChange={(value) => setForm((prev) => ({ ...prev, shortIdentifier: value }))}
            />
          </div>
          <label className="block text-sm text-slate-700">
            Валюта *
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
              <option value="">Выберите валюту</option>
              {currencies.map((currency) => (
                <option key={currency.id} value={currency.id}>
                  {currency.code} ({currency.symbol}) — {currency.name}
                </option>
              ))}
            </select>
          </label>
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

      <section className="space-y-3">
        {isLoading ? (
          <LoadingState message="Загружаем счета..." />
        ) : null}

        {!isLoading && accounts.length === 0 ? (
          <EmptyState message="Счета еще не добавлены." />
        ) : null}

        {!isLoading
          ? accounts.map((account) => {
              const currency = currencyById.get(account.currency_id);
              const iconOption = getIconOption(account.icon);
              const AccountIcon = iconOption.icon;
              return (
                <article
                  key={account.id}
                  className="rounded-2xl border p-4"
                  style={{
                    borderColor: account.color,
                    backgroundColor: toSoftBackground(account.color, 0.1),
                  }}
                >
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="flex items-center gap-2 text-base font-semibold text-slate-900">
                        <AccountIcon className="h-5 w-5 shrink-0" />
                        {account.name}
                      </h3>
                      <p className="text-sm text-slate-600">
                        {currency ? `${currency.code} ${currency.symbol}` : "Валюта не найдена"}
                      </p>
                    </div>
                    {account.short_identifier ? (
                      <span className="rounded-lg border border-black/10 bg-white/70 px-2 py-1 text-xs font-medium text-slate-700">
                        •••• {account.short_identifier}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      variant="flat"
                      className="border border-black/10 bg-white/85 text-slate-900 hover:bg-white"
                      onPress={() => handleEdit(account)}
                    >
                      Изменить
                    </Button>
                    <Button
                      size="sm"
                      color="danger"
                      variant="flat"
                      onPress={() => handleDelete(account.id)}
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
