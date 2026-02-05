import type { ComponentType } from "react";

type StatCardProps = {
  title: string;
  value: string;
  icon: ComponentType<{ className?: string }>;
  tone: "success" | "danger" | "primary";
};

const TONE_CLASS: Record<StatCardProps["tone"], string> = {
  success: "border-white/20 bg-emerald-400/16 text-emerald-50",
  danger: "border-white/20 bg-rose-400/16 text-rose-50",
  primary: "border-white/20 bg-sky-400/18 text-sky-50",
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
