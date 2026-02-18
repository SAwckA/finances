import type { ComponentType } from "react";
import { Card, CardBody } from "@heroui/react";

type StatCardProps = {
  title: string;
  value: string;
  icon: ComponentType<{ className?: string }>;
  tone: "success" | "danger" | "primary";
};

const TONE_CLASS: Record<StatCardProps["tone"], string> = {
  success:
    "bg-gradient-to-br from-success-300/78 to-success-200/58 text-black/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_10px_20px_rgba(22,163,74,0.22)] dark:from-success-500/45 dark:to-success-400/26 dark:text-white dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_12px_22px_rgba(22,163,74,0.28)]",
  danger:
    "bg-gradient-to-br from-danger-300/78 to-danger-200/58 text-black/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_10px_20px_rgba(225,29,72,0.22)] dark:from-danger-500/45 dark:to-danger-400/26 dark:text-white dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_12px_22px_rgba(225,29,72,0.28)]",
  primary:
    "bg-gradient-to-br from-primary-300/78 to-primary-200/58 text-black/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_10px_20px_rgba(2,132,199,0.22)] dark:from-primary-500/45 dark:to-primary-400/26 dark:text-white dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_12px_22px_rgba(2,132,199,0.28)]",
};

export function StatCard({ title, value, icon: Icon, tone }: StatCardProps) {
  return (
    <Card className={TONE_CLASS[tone]} shadow="none">
      <CardBody className="px-3 py-2.5">
        <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold">
          <Icon className="h-3.5 w-3.5" />
          {title}
        </div>
        <p className="text-lg font-bold">{value}</p>
      </CardBody>
    </Card>
  );
}
