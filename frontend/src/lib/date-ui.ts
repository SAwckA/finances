import type { DateValue } from "@internationalized/date";
import {
  getLocalTimeZone,
  parseDate,
  parseDateTime,
  parseZonedDateTime,
  toCalendarDate,
} from "@internationalized/date";

export type DateRangeState = {
  startDate: string;
  endDate: string;
};

type DateRangeValue = {
  start: DateValue;
  end: DateValue;
};

function pad(value: number): string {
  return value.toString().padStart(2, "0");
}

export function resolveDateLocale(): string {
  if (typeof navigator === "undefined") {
    return "ru-RU";
  }

  return navigator.language || "ru-RU";
}

export function toDateRangeValue(range: DateRangeState): DateRangeValue | null {
  if (!range.startDate || !range.endDate) {
    return null;
  }

  try {
    return {
      start: parseDate(range.startDate),
      end: parseDate(range.endDate),
    };
  } catch {
    return null;
  }
}

export function fromDateRangeValue(value: DateRangeValue | null): DateRangeState {
  if (!value) {
    return { startDate: "", endDate: "" };
  }

  return {
    startDate: toCalendarDate(value.start).toString(),
    endDate: toCalendarDate(value.end).toString(),
  };
}

export function toDateValue(value: string): DateValue | null {
  if (!value) {
    return null;
  }

  try {
    return parseDate(value);
  } catch {
    return null;
  }
}

export function fromDateValue(value: DateValue | null): string {
  if (!value) {
    return "";
  }

  return toCalendarDate(value).toString();
}

export function toDateTimeValue(value: string): DateValue | null {
  if (!value) {
    return null;
  }

  try {
    const [datePart, timePart = "00:00"] = value.split("T");
    return parseDateTime(`${datePart}T${timePart.length === 5 ? `${timePart}:00` : timePart}`);
  } catch {
    try {
      return parseZonedDateTime(value);
    } catch {
      return null;
    }
  }
}

export function fromDateTimeValue(value: DateValue | null): string {
  if (!value) {
    return "";
  }

  const nativeDate = value.toDate(getLocalTimeZone());
  return `${nativeDate.getFullYear()}-${pad(nativeDate.getMonth() + 1)}-${pad(nativeDate.getDate())}T${pad(
    nativeDate.getHours(),
  )}:${pad(nativeDate.getMinutes())}`;
}
