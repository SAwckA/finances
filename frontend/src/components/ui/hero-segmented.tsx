"use client";

import type { ReactNode } from "react";
import { Button, ButtonGroup } from "@heroui/react";

type SegmentOption<T extends string> = {
  key: T;
  label: ReactNode;
};

type HeroSegmentedProps<T extends string> = {
  options: SegmentOption<T>[];
  value: T;
  onChange: (nextValue: T) => void;
  className?: string;
};

export function HeroSegmented<T extends string>({
  options,
  value,
  onChange,
  className,
}: HeroSegmentedProps<T>) {
  return (
    <ButtonGroup
      className={`rounded-2xl bg-gradient-to-r from-content2/80 via-content1/90 to-content2/80 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_10px_20px_rgba(2,6,23,0.2)] ${className ?? ""}`}
      fullWidth
      radius="lg"
      variant="flat"
    >
      {options.map((option) => (
        <Button
          key={option.key}
          color={option.key === value ? "primary" : "default"}
          variant={option.key === value ? "solid" : "light"}
          className={
            option.key === value
              ? "bg-gradient-to-r from-primary to-primary-500 text-white shadow-[0_10px_18px_color-mix(in_srgb,var(--accent-primary)_28%,transparent)]"
              : "interactive-hover bg-content1/60 text-foreground-600"
          }
          onPress={() => onChange(option.key)}
        >
          {option.label}
        </Button>
      ))}
    </ButtonGroup>
  );
}
