import { ArrowDown, ArrowUp } from "lucide-react";
import { Card, CardBody } from "@heroui/react";
import { StatCard } from "@/components/ui/stat-card";

type UiBalanceSummaryCardProps = {
  totalBalance: string;
  income: string;
  expenses: string;
};

export function UiBalanceSummaryCard({ totalBalance, income, expenses }: UiBalanceSummaryCardProps) {
  return (
    <Card shadow="none">
      <CardBody className="rounded-[22px] p-4">
        <p className="text-center text-sm font-semibold text-[var(--text-secondary)]">Общий баланс</p>
        <p className="mt-1 text-center text-[2rem] font-extrabold tracking-tight text-[var(--text-primary)]">
          {totalBalance}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <StatCard icon={ArrowUp} title="Доходы" tone="success" value={income} />
          <StatCard icon={ArrowDown} title="Расходы" tone="danger" value={expenses} />
        </div>
      </CardBody>
    </Card>
  );
}
