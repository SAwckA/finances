import type { CSSProperties, ReactNode } from "react";
import { Chip } from "@heroui/react";

type HeroChipProps = {
  children: ReactNode;
  tone?: string;
  size?: "sm" | "md" | "lg";
  variant?: "solid" | "bordered" | "light" | "flat" | "faded" | "shadow" | "dot";
  className?: string;
};

export function HeroChip({
  children,
  tone,
  size = "sm",
  variant = "flat",
  className,
}: HeroChipProps) {
  const style: CSSProperties | undefined = tone
    ? {
        backgroundColor: `${tone}1a`,
        borderColor: `${tone}55`,
        color: tone,
      }
    : undefined;

  return (
    <Chip className={className} size={size} variant={variant} style={style}>
      {children}
    </Chip>
  );
}
