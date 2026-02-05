import type { ComponentType } from "react";

type ActionTileProps = {
  label: string;
  icon: ComponentType<{ className?: string }>;
  iconClassName: string;
  onClick?: () => void;
};

export function ActionTile({ label, icon: Icon, iconClassName, onClick }: ActionTileProps) {
  return (
    <button
      type="button"
      className="rounded-2xl border border-[color:var(--border-soft)] bg-[var(--bg-card)] px-2 py-2.5 text-center transition hover:bg-slate-50/80"
      onClick={onClick}
    >
      <span className={`mx-auto inline-flex h-8 w-8 items-center justify-center rounded-lg ${iconClassName}`}>
        <Icon className="h-4.5 w-4.5" />
      </span>
      <p className="mt-1 text-xs font-semibold text-[var(--text-secondary)]">{label}</p>
    </button>
  );
}
