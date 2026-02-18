import type { ReactNode } from "react";
import { ArrowDown, ArrowRightLeft, ArrowUp } from "lucide-react";
import { Card, CardBody } from "@heroui/react";
import { getIconOption } from "@/lib/icon-catalog";
import type { TransactionType } from "@/lib/types";

type UiTransactionTileProps = {
  name: string;
  subtitle: ReactNode;
  amount: string;
  dateLabel: string;
  type: TransactionType;
  categoryIcon: string | null;
  categoryColor?: string | null;
  metaBadge?: ReactNode;
  className?: string;
  onPress?: () => void;
};

function typeMeta(type: TransactionType): {
  sign: string;
  amountClassName: string;
  iconClassName: string;
  fallbackIcon: typeof ArrowDown;
} {
  if (type === "income") {
    return {
      sign: "+",
      amountClassName: "text-success-600",
      iconClassName: "bg-success-500/15 text-success-600",
      fallbackIcon: ArrowUp,
    };
  }

  if (type === "transfer") {
    return {
      sign: "",
      amountClassName: "text-primary-600",
      iconClassName: "bg-primary-500/15 text-primary-600",
      fallbackIcon: ArrowRightLeft,
    };
  }

  return {
    sign: "-",
    amountClassName: "text-danger-600",
    iconClassName: "bg-danger-500/15 text-danger-600",
    fallbackIcon: ArrowDown,
  };
}

export function UiTransactionTile({
  name,
  subtitle,
  amount,
  dateLabel,
  type,
  categoryIcon,
  categoryColor,
  metaBadge,
  className,
  onPress,
}: UiTransactionTileProps) {
  const meta = typeMeta(type);
  const categoryOption = categoryIcon ? getIconOption(categoryIcon) : null;
  const Icon = categoryOption ? categoryOption.icon : meta.fallbackIcon;
  const iconStyle = categoryColor
    ? { backgroundColor: `${categoryColor}22`, color: categoryColor }
    : undefined;
  const iconClassName = categoryColor ? "" : meta.iconClassName;

  const cardClassName = `w-full interactive-hover bg-gradient-to-br from-content2/80 to-content1 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_8px_16px_rgba(2,6,23,0.14)] ${
    className ?? ""
  }`;

  return (
    <Card className={cardClassName} isPressable={Boolean(onPress)} onPress={onPress} shadow="none">
      <CardBody className="px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${iconClassName}`} style={iconStyle}>
              <Icon className="h-4.5 w-4.5" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{name}</p>
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-[var(--text-secondary)]">{subtitle}</div>
            </div>
          </div>
          <div className="text-right">
            <p className={`text-sm font-bold ${meta.amountClassName}`}>
              {meta.sign}
              {amount}
            </p>
            <p className="text-xs text-[var(--text-secondary)]">{dateLabel}</p>
            {metaBadge ? <div className="mt-1 flex justify-end">{metaBadge}</div> : null}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
