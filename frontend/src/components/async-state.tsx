import { Skeleton } from "@/components/ui/skeleton";

type AsyncStateProps = {
  message: string;
  className?: string;
};

export function LoadingState({ message, className }: AsyncStateProps) {
  return (
    <div className={className ?? "app-panel p-4"}>
      <div className="space-y-2.5">
        <p className="text-sm text-[var(--text-secondary)]">{message}</p>
        <div className="space-y-2">
          <Skeleton className="h-2.5 w-4/5" />
          <Skeleton className="h-2.5 w-3/5" />
        </div>
      </div>
    </div>
  );
}

export function ErrorState({ message, className }: AsyncStateProps) {
  return (
    <div
      className={
        className ?? "rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700"
      }
      role="alert"
    >
      {message}
    </div>
  );
}

export function EmptyState({ message, className }: AsyncStateProps) {
  return (
    <div
      className={
        className ??
        "rounded-2xl border border-dashed border-[color:var(--border-soft)] bg-[color:color-mix(in_srgb,var(--bg-card)_85%,transparent)] p-4 text-sm text-[var(--text-secondary)]"
      }
    >
      {message}
    </div>
  );
}
