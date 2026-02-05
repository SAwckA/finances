import { ArrowDown, ArrowRightLeft, ArrowUp } from "lucide-react";
import { getIconOption } from "@/lib/icon-catalog";
import type { TransactionType } from "@/lib/types";

type TransactionRowProps = {
  name: string;
  subtitle: string;
  amount: string;
  dateLabel: string;
  type: TransactionType;
  categoryIcon: string | null;
};

function typeMeta(type: TransactionType): {
  sign: string;
  amountClassName: string;
  iconClassName: string;
  fallbackIcon: typeof ArrowDown;
} {
  if (type === "income") {
    return {
      sign: "+",
      amountClassName: "text-emerald-600",
      iconClassName: "bg-emerald-500/15 text-emerald-600",
      fallbackIcon: ArrowUp,
    };
  }

  if (type === "transfer") {
    return {
      sign: "",
      amountClassName: "text-sky-600",
      iconClassName: "bg-sky-500/15 text-sky-600",
      fallbackIcon: ArrowRightLeft,
    };
  }

  return {
    sign: "-",
    amountClassName: "text-rose-600",
    iconClassName: "bg-rose-500/15 text-rose-600",
    fallbackIcon: ArrowDown,
  };
}

export function TransactionRow({
  name,
  subtitle,
  amount,
  dateLabel,
  type,
  categoryIcon,
}: TransactionRowProps) {
  const meta = typeMeta(type);
  const categoryOption = categoryIcon ? getIconOption(categoryIcon) : null;
  const Icon = categoryOption ? categoryOption.icon : meta.fallbackIcon;

  return (
    <article className="rounded-2xl border border-[color:var(--border-soft)] bg-[var(--bg-card)] px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${meta.iconClassName}`}>
            <Icon className="h-4.5 w-4.5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{name}</p>
            <p className="truncate text-xs text-[var(--text-secondary)]">{subtitle}</p>
          </div>
        </div>
        <div className="text-right">
          <p className={`text-sm font-bold ${meta.amountClassName}`}>
            {meta.sign}
            {amount}
          </p>
          <p className="text-xs text-[var(--text-secondary)]">{dateLabel}</p>
        </div>
      </div>
    </article>
  );
}
