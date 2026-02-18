import { DateRangePicker } from "@heroui/react";
import { toCalendarDate, type DateValue } from "@internationalized/date";
import type { ComponentProps } from "react";
import { toDateRangeValue, type DateRangeState } from "@/lib/date-ui";

type UiDateRangeFieldProps = {
  label: string;
  value: DateRangeState;
  onChange: (next: DateRangeState) => void;
  className?: string;
  isDisabled?: boolean;
  classNames?: ComponentProps<typeof DateRangePicker>["classNames"];
};

type SafeRangeValue = {
  start?: DateValue | null;
  end?: DateValue | null;
} | null;

function toDateString(value: DateValue | null | undefined): string | null {
  if (!value) {
    return null;
  }
  return toCalendarDate(value).toString();
}

export function UiDateRangeField({
  label,
  value,
  onChange,
  className,
  isDisabled = false,
  classNames,
}: UiDateRangeFieldProps) {
  return (
    <DateRangePicker
      className={className}
      classNames={classNames}
      granularity="day"
      isDisabled={isDisabled}
      label={label}
      value={toDateRangeValue(value) as never}
      popoverProps={{ shouldBlockScroll: false, isNonModal: true }}
      onChange={(nextValue) => {
        const safeValue = nextValue as SafeRangeValue;
        const nextStart = toDateString(safeValue?.start) ?? value.startDate;
        const nextEnd = toDateString(safeValue?.end) ?? value.endDate;

        if (!nextStart || !nextEnd) {
          return;
        }

        if (nextStart <= nextEnd) {
          onChange({ startDate: nextStart, endDate: nextEnd });
          return;
        }

        onChange({ startDate: nextEnd, endDate: nextStart });
      }}
    />
  );
}
