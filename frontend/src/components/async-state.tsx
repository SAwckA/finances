import { Spinner } from "@heroui/react";

type AsyncStateProps = {
  message: string;
  className?: string;
};

export function LoadingState({ message, className }: AsyncStateProps) {
  return (
    <div className={className ?? "rounded-2xl border border-slate-200 bg-white p-4"}>
      <div className="flex items-center gap-2">
        <Spinner size="sm" />
        <p className="text-sm text-slate-700">{message}</p>
      </div>
    </div>
  );
}

export function ErrorState({ message, className }: AsyncStateProps) {
  return (
    <div
      className={
        className ?? "rounded-xl border border-danger-200 bg-danger-50 p-3 text-sm text-danger"
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
        className ?? "rounded-2xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-600"
      }
    >
      {message}
    </div>
  );
}
