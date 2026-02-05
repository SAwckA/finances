import { Spinner } from "@heroui/react";

type AsyncStateProps = {
  message: string;
  className?: string;
};

export function LoadingState({ message, className }: AsyncStateProps) {
  return (
    <div className={className ?? "app-panel p-4"}>
      <div className="flex items-center gap-2">
        <Spinner size="sm" />
        <p className="text-sm text-[var(--text-secondary)]">{message}</p>
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
        "rounded-2xl border border-dashed border-[color:var(--border-soft)] bg-white/75 p-4 text-sm text-[var(--text-secondary)]"
      }
    >
      {message}
    </div>
  );
}
