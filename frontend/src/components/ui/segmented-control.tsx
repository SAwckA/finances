"use client";

import type { ReactNode } from "react";
import { HeroSegmented } from "@/components/ui/hero-segmented";

type SegmentOption<T extends string> = {
  key: T;
  label: ReactNode;
};

type SegmentedControlProps<T extends string> = {
  options: SegmentOption<T>[];
  value: T;
  onChange: (nextValue: T) => void;
};

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  return <HeroSegmented options={options} value={value} onChange={onChange} className="w-full" />;
}
