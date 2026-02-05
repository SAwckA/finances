import { Landmark } from "lucide-react";

type SourceCardProps = {
  name: string;
  identifier: string;
  amount: string;
};

export function SourceCard({ name, identifier, amount }: SourceCardProps) {
  return (
    <article className="rounded-2xl border border-[color:var(--border-soft)] bg-[var(--bg-card)] px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/15 text-sky-600">
            <Landmark className="h-4.5 w-4.5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{name}</p>
            <p className="truncate text-xs text-[var(--text-secondary)]">{identifier}</p>
          </div>
        </div>
        <p className="text-sm font-bold text-[var(--text-primary)]">{amount}</p>
      </div>
    </article>
  );
}
