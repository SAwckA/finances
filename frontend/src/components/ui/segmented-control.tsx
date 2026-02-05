"use client";

import type { ReactNode } from "react";

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
  return (
    <div
      className="mobile-card grid gap-1.5 p-1.5"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((option) => {
        const active = option.key === value;
        return (
          <button
            key={option.key}
            type="button"
            className={`rounded-xl px-2.5 py-2 text-sm font-semibold transition ${
              active
                ? "bg-[var(--accent-primary)] text-white"
                : "surface-hover bg-transparent text-[var(--text-secondary)]"
            }`}
            onClick={() => onChange(option.key)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
