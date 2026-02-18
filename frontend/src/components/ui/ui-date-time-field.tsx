import { DatePicker } from "@heroui/react";
import type { ComponentProps } from "react";
import { fromDateTimeValue, toDateTimeValue } from "@/lib/date-ui";

type UiDateTimeFieldProps = {
  label: string;
  value: string;
  onChange: (nextValue: string) => void;
  className?: string;
  isDisabled?: boolean;
  classNames?: ComponentProps<typeof DatePicker>["classNames"];
};

export function UiDateTimeField({
  label,
  value,
  onChange,
  className,
  isDisabled = false,
  classNames,
}: UiDateTimeFieldProps) {
  return (
    <DatePicker
      className={className}
      classNames={classNames}
      granularity="minute"
      isDisabled={isDisabled}
      label={label}
      showMonthAndYearPickers
      value={toDateTimeValue(value) as never}
      onChange={(nextValue) => onChange(fromDateTimeValue(nextValue as never))}
    />
  );
}
