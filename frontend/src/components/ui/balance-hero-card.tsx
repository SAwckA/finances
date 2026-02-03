import { ArrowDown, ArrowUp } from "lucide-react";
import { StatCard } from "@/components/ui/stat-card";

type BalanceHeroCardProps = {
  totalBalance: string;
  income: string;
  expenses: string;
};

export function BalanceHeroCard({ totalBalance, income, expenses }: BalanceHeroCardProps) {
  return (
    <section className="dark-hero rounded-[22px] border border-white/15 p-4 shadow-[var(--shadow-strong)]">
      <p className="text-center text-sm font-semibold text-white/80">Total Balance</p>
      <p className="mt-1 text-center text-[2rem] font-extrabold tracking-tight text-white">{totalBalance}</p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <StatCard title="Income" value={income} icon={ArrowUp} tone="success" />
        <StatCard title="Expenses" value={expenses} icon={ArrowDown} tone="danger" />
      </div>
    </section>
  );
}
