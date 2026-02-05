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
      className="rounded-2xl border border-white/10 bg-[var(--bg-surface-dark-soft)] px-2 py-2.5 text-center transition hover:bg-[#2a3a5b]"
      onClick={onClick}
    >
      <span className={`mx-auto inline-flex h-8 w-8 items-center justify-center rounded-lg ${iconClassName}`}>
        <Icon className="h-4.5 w-4.5" />
      </span>
      <p className="mt-1 text-xs font-semibold text-white/80">{label}</p>
    </button>
  );
}
