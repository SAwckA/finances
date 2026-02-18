import type { ComponentType } from "react";
import { HeroTile } from "@/components/ui/hero-tile";

type ActionTileProps = {
  label: string;
  icon: ComponentType<{ className?: string }>;
  iconClassName: string;
  onClick?: () => void;
  href?: string;
};

export function ActionTile({ label, icon: Icon, iconClassName, onClick, href }: ActionTileProps) {
  return <HeroTile label={label} icon={Icon} iconClassName={iconClassName} onClick={onClick} href={href} />;
}
