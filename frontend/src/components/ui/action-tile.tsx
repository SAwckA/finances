import type { ComponentType } from "react";
import Link from "next/link";

type ActionTileProps = {
  label: string;
  icon: ComponentType<{ className?: string }>;
  iconClassName: string;
  onClick?: () => void;
  href?: string;
};

export function ActionTile({ label, icon: Icon, iconClassName, onClick, href }: ActionTileProps) {
  const className =
    "surface-hover rounded-2xl border border-[color:var(--border-soft)] bg-[var(--bg-card)] px-2 py-2.5 text-center transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]/30";

  if (href) {
    return (
      <Link href={href} className={className}>
        <span className={`mx-auto inline-flex h-8 w-8 items-center justify-center rounded-lg ${iconClassName}`}>
          <Icon className="h-4.5 w-4.5" aria-hidden="true" />
        </span>
        <p className="mt-1 text-xs font-semibold text-[var(--text-secondary)]">{label}</p>
      </Link>
    );
  }

  return (
    <button
      type="button"
      className={className}
      onClick={onClick}
    >
      <span className={`mx-auto inline-flex h-8 w-8 items-center justify-center rounded-lg ${iconClassName}`}>
        <Icon className="h-4.5 w-4.5" aria-hidden="true" />
      </span>
      <p className="mt-1 text-xs font-semibold text-[var(--text-secondary)]">{label}</p>
    </button>
  );
}
