"use client";

import { useEffect, useMemo, useState } from "react";
import { Input, Spinner } from "@heroui/react";
import { ScreenHeader } from "@/components/screen-header";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/features/auth/auth-context";
import type { CurrencyResponse } from "@/lib/types";

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return `Ошибка API (${error.status}).`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Не удалось загрузить валюты.";
}

export default function CurrenciesSettingsPage() {
  const { authenticatedRequest } = useAuth();
  const [currencies, setCurrencies] = useState<CurrencyResponse[]>([]);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const data = await authenticatedRequest<CurrencyResponse[]>("/api/currencies?limit=200");
        setCurrencies(data);
      } catch (error) {
        setErrorMessage(getErrorMessage(error));
      } finally {
        setIsLoading(false);
      }
    };

    void loadData();
  }, [authenticatedRequest]);

  const filteredCurrencies = useMemo(() => {
    if (!query.trim()) {
      return currencies;
    }

    const normalized = query.trim().toLowerCase();
    return currencies.filter((currency) => {
      return (
        currency.code.toLowerCase().includes(normalized) ||
        currency.name.toLowerCase().includes(normalized) ||
        currency.symbol.toLowerCase().includes(normalized)
      );
    });
  }, [currencies, query]);

  return (
    <>
      <ScreenHeader
        title="Валюты"
        description="Справочник валют для счетов и отображения финансовых сумм."
      />
      <section className="mb-4 rounded-2xl border border-slate-200 bg-white p-4">
        <Input
          label="Поиск валюты"
          placeholder="USD, EUR, ₽..."
          value={query}
          onValueChange={setQuery}
        />
      </section>

      <section className="space-y-3">
        {errorMessage ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            {errorMessage}
          </div>
        ) : null}

        {isLoading ? (
          <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-4">
            <Spinner size="sm" />
            <p className="text-sm text-slate-700">Загружаем валюты...</p>
          </div>
        ) : null}

        {!isLoading && filteredCurrencies.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-600">
            Валюты не найдены.
          </div>
        ) : null}

        {!isLoading
          ? filteredCurrencies.map((currency) => (
              <article key={currency.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-slate-900">{currency.code}</h2>
                    <p className="text-sm text-slate-600">{currency.name}</p>
                  </div>
                  <p className="text-xl font-semibold text-slate-900">{currency.symbol}</p>
                </div>
              </article>
            ))
          : null}
      </section>
    </>
  );
}
