import { getIconOption } from "@/lib/icon-catalog";
import type { CategorySummaryResponse, PeriodStatisticsResponse } from "@/lib/types";

type CategoryBreakdownsProps = {
  summary: PeriodStatisticsResponse | null;
  currencyCode: string;
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

function percent(part: string, total: string): number {
  const partValue = Number(part);
  const totalValue = Number(total);
  if (Number.isNaN(partValue) || Number.isNaN(totalValue) || totalValue <= 0) {
    return 0;
  }

  return Math.min(100, Math.round((partValue / totalValue) * 100));
}

function CategoryBlock({
  title,
  items,
  total,
  currencyCode,
  progressClassName,
  emptyMessage,
}: {
  title: string;
  items: CategorySummaryResponse[];
  total: string;
  currencyCode: string;
  progressClassName: string;
  emptyMessage: string;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4">
      <h3 className="mb-3 text-base font-semibold text-slate-900">{title}</h3>
      <div className="space-y-2.5">
        {items.length ? (
          items.map((item) => {
            const CategoryIcon = getIconOption(item.category_icon).icon;
            const share = percent(item.amount, total);
            return (
              <div key={item.category_id}>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-black/10"
                      style={{ backgroundColor: `${item.category_color}20`, color: item.category_color }}
                    >
                      <CategoryIcon className="h-3.5 w-3.5" />
                    </span>
                    <span className="truncate text-sm text-slate-800">{item.category_name}</span>
                  </div>
                  <span className="text-xs font-semibold text-slate-700">
                    {formatAmount(item.amount, currencyCode)}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-slate-100">
                  <div className={`h-2 rounded-full ${progressClassName}`} style={{ width: `${share}%` }} />
                </div>
              </div>
            );
          })
        ) : (
          <p className="text-sm text-slate-600">{emptyMessage}</p>
        )}
      </div>
    </article>
  );
}

export default function CategoryBreakdowns({ summary, currencyCode }: CategoryBreakdownsProps) {
  return (
    <section className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      <CategoryBlock
        title="Доходы по категориям"
        items={summary?.income_by_category ?? []}
        total={summary?.total_income ?? "0"}
        currencyCode={currencyCode}
        progressClassName="bg-emerald-500"
        emptyMessage="Нет доходов за выбранный период."
      />
      <CategoryBlock
        title="Расходы по категориям"
        items={summary?.expense_by_category ?? []}
        total={summary?.total_expense ?? "0"}
        currencyCode={currencyCode}
        progressClassName="bg-rose-500"
        emptyMessage="Нет расходов за выбранный период."
      />
    </section>
  );
}
