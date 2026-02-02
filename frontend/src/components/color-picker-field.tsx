"use client";

type ColorPickerFieldProps = {
  label: string;
  value: string;
  onChange: (nextValue: string) => void;
};

function toSoftBackground(hexColor: string, alpha: number): string {
  const hex = hexColor.replace("#", "");
  const normalized = hex.length === 3 ? hex.split("").map((char) => `${char}${char}`).join("") : hex;

  if (normalized.length !== 6) {
    return "rgba(148, 163, 184, 0.1)";
  }

  const value = Number.parseInt(normalized, 16);
  if (Number.isNaN(value)) {
    return "rgba(148, 163, 184, 0.1)";
  }

  const red = (value >> 16) & 255;
  const green = (value >> 8) & 255;
  const blue = value & 255;
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

export function ColorPickerField({ label, value, onChange }: ColorPickerFieldProps) {
  return (
    <div>
      <p className="mb-1 text-sm text-slate-700">{label}</p>
      <label
        className="flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-sm text-slate-700"
        style={{ borderColor: value, backgroundColor: toSoftBackground(value, 0.12) }}
      >
        <span className="inline-flex h-6 w-6 rounded-full border border-black/10" style={{ backgroundColor: value }} />
        <input
          aria-label={label}
          className="h-8 w-12 cursor-pointer rounded-lg border border-slate-300 bg-white p-1"
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value.toUpperCase())}
        />
        <span>Выбрать цвет</span>
      </label>
    </div>
  );
}
