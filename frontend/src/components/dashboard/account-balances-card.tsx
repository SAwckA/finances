import { Landmark } from "lucide-react";
import type { AccountBalanceResponse } from "@/lib/types";

type AccountBalancesCardProps = {
  balances: AccountBalanceResponse[];
};

function formatAmount(value: string, currencyCode: string): string {
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

export default function AccountBalancesCard({ balances }: AccountBalancesCardProps) {
  return (
    <section className="mb-4 rounded-2xl border border-default-200 bg-white p-4">
      <div className="mb-3 flex items-center gap-2">
        <Landmark className="h-4 w-4 text-default-600" />
        <h2 className="text-base font-semibold text-default-900">Балансы по счетам</h2>
      </div>

      <div className="space-y-2.5">
        {balances.length === 0 ? (
          <p className="text-sm text-default-600">Счета не найдены.</p>
        ) : (
          balances.map((account) => (
            <article
              key={account.account_id}
              className="flex items-center justify-between rounded-xl border border-default-200 bg-default-50 px-3 py-2.5"
            >
              <p className="min-w-0 truncate text-sm font-medium text-default-900">{account.account_name}</p>
              <p className="text-sm font-semibold text-default-800">
                {formatAmount(account.balance, account.currency_code)}
              </p>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
