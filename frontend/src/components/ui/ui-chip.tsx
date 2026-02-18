import type { CSSProperties, ReactNode } from "react";
import { Chip } from "@heroui/react";

type UiChipProps = {
  children: ReactNode;
  tone?: string;
  size?: "sm" | "md" | "lg";
  variant?: "solid" | "bordered" | "light" | "flat" | "faded" | "shadow" | "dot";
  className?: string;
};

export function UiChip({ children, tone, size = "sm", variant = "flat", className }: UiChipProps) {
  const style: CSSProperties | undefined = tone
    ? {
        backgroundColor: `${tone}1a`,
        borderColor: `${tone}55`,
        color: tone,
      }
    : undefined;

  return (
    <Chip className={className} size={size} style={style} variant={variant}>
      {children}
    </Chip>
  );
}
