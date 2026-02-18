import type { ComponentType } from "react";
import Link from "next/link";
import { Card, CardBody } from "@heroui/react";

type HeroTileProps = {
  label: string;
  icon: ComponentType<{ className?: string }>;
  iconClassName: string;
  onClick?: () => void;
  href?: string;
};

export function HeroTile({ label, icon: Icon, iconClassName, onClick, href }: HeroTileProps) {
  const tileClassName =
    "interactive-hover bg-gradient-to-br from-content2/82 to-content1 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_8px_16px_rgba(2,6,23,0.14)]";

  if (href) {
    return (
      <Card
        as={Link}
        href={href}
        className={tileClassName}
        isPressable
        shadow="none"
      >
        <CardBody className="items-center px-2 py-2.5 text-center">
          <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${iconClassName}`}>
            <Icon className="h-4.5 w-4.5" aria-hidden="true" />
          </span>
          <p className="mt-1 text-xs font-semibold text-[var(--text-secondary)]">{label}</p>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card className={tileClassName} isPressable shadow="none" onPress={onClick}>
      <CardBody className="items-center px-2 py-2.5 text-center">
        <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${iconClassName}`}>
          <Icon className="h-4.5 w-4.5" aria-hidden="true" />
        </span>
        <p className="mt-1 text-xs font-semibold text-[var(--text-secondary)]">{label}</p>
      </CardBody>
    </Card>
  );
}
