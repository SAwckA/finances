import { DatePicker } from "@heroui/react";
import type { ComponentProps } from "react";
import { fromDateTimeValue, toDateTimeValue } from "@/lib/date-ui";

type HeroDateTimeFieldProps = {
  label: string;
  value: string;
  onChange: (nextValue: string) => void;
  className?: string;
  isDisabled?: boolean;
  classNames?: ComponentProps<typeof DatePicker>["classNames"];
};

export function HeroDateTimeField({
  label,
  value,
  onChange,
  className,
  isDisabled = false,
  classNames,
}: HeroDateTimeFieldProps) {
  return (
    <DatePicker
      className={className}
      classNames={classNames}
      granularity="minute"
      label={label}
      value={toDateTimeValue(value)}
      isDisabled={isDisabled}
      showMonthAndYearPickers
      onChange={(nextValue) => onChange(fromDateTimeValue(nextValue))}
    />
  );
}
