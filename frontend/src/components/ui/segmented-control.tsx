"use client";

type SegmentOption<T extends string> = {
  key: T;
  label: string;
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
    <div className="mobile-card grid grid-cols-3 gap-1.5 p-1.5">
      {options.map((option) => {
        const active = option.key === value;
        return (
          <button
            key={option.key}
            type="button"
            className={`rounded-xl px-2.5 py-2 text-sm font-semibold transition ${
              active
                ? "bg-[var(--accent-primary)] text-white"
                : "bg-transparent text-slate-600 hover:bg-slate-100"
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
