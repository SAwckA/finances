import { Landmark } from "lucide-react";

type SourceCardProps = {
  name: string;
  identifier: string;
  amount: string;
};

export function SourceCard({ name, identifier, amount }: SourceCardProps) {
  return (
    <article className="rounded-2xl border border-white/10 bg-[var(--bg-surface-dark-soft)] px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/25 text-sky-300">
            <Landmark className="h-4.5 w-4.5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white/90">{name}</p>
            <p className="truncate text-xs text-white/55">{identifier}</p>
          </div>
        </div>
        <p className="text-sm font-bold text-white">{amount}</p>
      </div>
    </article>
  );
}
