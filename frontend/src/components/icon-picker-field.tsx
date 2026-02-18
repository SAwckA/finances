"use client";

import { useMemo, useState } from "react";
import { getIconOption, ICON_OPTIONS } from "@/lib/icon-catalog";

type IconPickerFieldProps = {
  label: string;
  value: string;
  onChange: (nextValue: string) => void;
};

export function IconPickerField({ label, value, onChange }: IconPickerFieldProps) {
  const [expanded, setExpanded] = useState(false);
  const selected = getIconOption(value);
  const SelectedIcon = selected.icon;
  const visibleOptions = useMemo(() => {
    if (expanded) {
      return ICON_OPTIONS;
    }

    return ICON_OPTIONS.filter((option) => option.featured);
  }, [expanded]);

  return (
    <div>
      <p className="mb-1 text-sm text-default-700">{label}</p>
      <div className="mb-2 flex items-center gap-2 rounded-xl border border-default-200 bg-default-50 px-3 py-2">
        <SelectedIcon className="h-4 w-4 text-default-700" />
        <span className="text-sm text-default-700">{selected.label}</span>
      </div>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
        {visibleOptions.map((option) => {
          const Icon = option.icon;
          const active = option.value === selected.value;

          return (
            <button
              key={option.value}
              type="button"
              className={`flex h-11 items-center justify-center rounded-xl border transition ${
                active
                  ? "border-default-900 bg-default-900 text-white"
                  : "surface-hover border-default-300 bg-white text-default-700"
              }`}
              onClick={() => onChange(option.value)}
              aria-label={option.label}
              title={option.label}
            >
              <Icon className="h-4 w-4" />
            </button>
          );
        })}
      </div>
      <button
        type="button"
        className="mt-2 text-xs font-medium text-default-700 underline decoration-dotted underline-offset-4"
        onClick={() => setExpanded((prev) => !prev)}
      >
        {expanded ? "Скрыть дополнительные иконки" : "Показать больше иконок"}
      </button>
    </div>
  );
}
