import type { ReactNode } from "react";
import { Landmark } from "lucide-react";
import { getIconOption } from "@/lib/icon-catalog";

type SourceCardProps = {
  name: string;
  identifier: ReactNode;
  amount: string;
  onClick?: () => void;
  selected?: boolean;
  tone?: string;
  icon?: string | null;
};

export function SourceCard({ name, identifier, amount, onClick, selected = false, tone, icon }: SourceCardProps) {
  const iconStyle = tone ? { backgroundColor: `${tone}22`, color: tone } : undefined;
  const iconOption = icon ? getIconOption(icon) : null;
  const Icon = iconOption ? iconOption.icon : Landmark;
  const baseClassName =
    "w-full rounded-2xl border px-3 py-2.5 text-left transition surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]/40";
  const cardClassName = selected
    ? `${baseClassName} border-[var(--accent-primary)] bg-[var(--accent-primary)]/10`
    : `${baseClassName} border-[color:var(--border-soft)] bg-[var(--bg-card)]`;

  if (onClick) {
    return (
      <button type="button" className={cardClassName} onClick={onClick}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl" style={iconStyle}>
              <Icon className="h-4.5 w-4.5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{name}</p>
              <div className="truncate text-xs text-[var(--text-secondary)]">{identifier}</div>
            </div>
          </div>
          <p className="text-sm font-bold text-[var(--text-primary)]">{amount}</p>
        </div>
      </button>
    );
  }

  return (
    <article className={cardClassName}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl" style={iconStyle}>
            <Icon className="h-4.5 w-4.5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{name}</p>
            <div className="truncate text-xs text-[var(--text-secondary)]">{identifier}</div>
          </div>
        </div>
        <p className="text-sm font-bold text-[var(--text-primary)]">{amount}</p>
      </div>
    </article>
  );
}
