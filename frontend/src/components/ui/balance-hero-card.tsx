import { ArrowDown, ArrowUp } from "lucide-react";
import { StatCard } from "@/components/ui/stat-card";

type BalanceHeroCardProps = {
  totalBalance: string;
  income: string;
  expenses: string;
};

export function BalanceHeroCard({ totalBalance, income, expenses }: BalanceHeroCardProps) {
  return (
    <section className="mobile-card rounded-[22px] p-4">
      <p className="text-center text-sm font-semibold text-[var(--text-secondary)]">Total Balance</p>
      <p className="mt-1 text-center text-[2rem] font-extrabold tracking-tight text-[var(--text-primary)]">
        {totalBalance}
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <StatCard title="Income" value={income} icon={ArrowUp} tone="success" />
        <StatCard title="Expenses" value={expenses} icon={ArrowDown} tone="danger" />
      </div>
    </section>
  );
}
