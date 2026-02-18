import { DateRangePicker } from "@heroui/react";
import type { ComponentProps } from "react";
import { fromDateRangeValue, toDateRangeValue, type DateRangeState } from "@/lib/date-ui";

type HeroDateRangeFieldProps = {
  label: string;
  value: DateRangeState;
  onChange: (next: DateRangeState) => void;
  className?: string;
  isDisabled?: boolean;
  classNames?: ComponentProps<typeof DateRangePicker>["classNames"];
};

export function HeroDateRangeField({
  label,
  value,
  onChange,
  className,
  isDisabled = false,
  classNames,
}: HeroDateRangeFieldProps) {
  return (
    <DateRangePicker
      className={className}
      classNames={classNames}
      granularity="day"
      label={label}
      value={toDateRangeValue(value)}
      isDisabled={isDisabled}
      showMonthAndYearPickers
      onChange={(nextValue) => onChange(fromDateRangeValue(nextValue))}
    />
  );
}
