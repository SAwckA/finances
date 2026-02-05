import type { ComponentType } from "react";

type StatCardProps = {
  title: string;
  value: string;
  icon: ComponentType<{ className?: string }>;
  tone: "success" | "danger" | "primary";
};

const TONE_CLASS: Record<StatCardProps["tone"], string> = {
  success:
    "border-emerald-200 bg-emerald-50/80 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-500/15 dark:text-emerald-200",
  danger:
    "border-rose-200 bg-rose-50/80 text-rose-700 dark:border-rose-400/30 dark:bg-rose-500/15 dark:text-rose-200",
  primary:
    "border-sky-200 bg-sky-50/80 text-sky-700 dark:border-sky-400/30 dark:bg-sky-500/15 dark:text-sky-200",
};

export function StatCard({ title, value, icon: Icon, tone }: StatCardProps) {
  return (
    <article className={`rounded-2xl border px-3 py-2.5 ${TONE_CLASS[tone]}`}>
      <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold">
        <Icon className="h-3.5 w-3.5" />
        {title}
      </div>
      <p className="text-lg font-bold">{value}</p>
    </article>
  );
}
