import type { ReactNode } from "react";
import { Landmark } from "lucide-react";
import { Card, CardBody } from "@heroui/react";
import { getIconOption } from "@/lib/icon-catalog";

type UiSourceTileProps = {
  name: string;
  identifier: ReactNode;
  amount: string;
  onClick?: () => void;
  selected?: boolean;
  tone?: string;
  icon?: string | null;
};

export function UiSourceTile({
  name,
  identifier,
  amount,
  onClick,
  selected = false,
  tone,
  icon,
}: UiSourceTileProps) {
  const iconStyle = tone ? { backgroundColor: `${tone}22`, color: tone } : undefined;
  const iconOption = icon ? getIconOption(icon) : null;
  const Icon = iconOption ? iconOption.icon : Landmark;
  const cardClassName = selected
    ? "w-full interactive-hover bg-gradient-to-br from-primary/22 via-primary/8 to-content2/70"
    : "w-full interactive-hover bg-gradient-to-br from-content2/85 to-content1";

  if (onClick) {
    return (
      <Card className={cardClassName} isPressable shadow="none" onPress={onClick}>
        <CardBody className="px-3 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl" style={iconStyle}>
                <Icon className="h-4.5 w-4.5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{name}</p>
                <div className="truncate text-xs text-[var(--text-secondary)]">{identifier}</div>
              </div>
            </div>
            <p className="text-sm font-bold text-[var(--text-primary)]">{amount}</p>
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card className={cardClassName} shadow="none">
      <CardBody className="px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl" style={iconStyle}>
              <Icon className="h-4.5 w-4.5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{name}</p>
              <div className="truncate text-xs text-[var(--text-secondary)]">{identifier}</div>
            </div>
          </div>
          <p className="text-sm font-bold text-[var(--text-primary)]">{amount}</p>
        </div>
      </CardBody>
    </Card>
  );
}
