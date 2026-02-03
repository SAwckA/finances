import type { ComponentType } from "react";

type StatCardProps = {
  title: string;
  value: string;
  icon: ComponentType<{ className?: string }>;
  tone: "success" | "danger" | "primary";
};

const TONE_CLASS: Record<StatCardProps["tone"], string> = {
  success: "bg-emerald-100/30 text-emerald-50 border-white/20",
  danger: "bg-rose-100/30 text-rose-50 border-white/20",
  primary: "bg-indigo-100/30 text-indigo-50 border-white/20",
};

export function StatCard({ title, value, icon: Icon, tone }: StatCardProps) {
  return (
    <article className={`rounded-2xl border px-3 py-2.5 ${TONE_CLASS[tone]}`}>
      <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-white/85">
        <Icon className="h-3.5 w-3.5" />
        {title}
      </div>
      <p className="text-lg font-bold text-white">{value}</p>
    </article>
  );
}
