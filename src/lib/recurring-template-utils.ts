import type { Day } from "date-fns";
import { addDays, addMonths, nextDay, setDate, startOfDay } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { RecurrenceType } from "./../generated/prisma/enums";

export class RecurrenceValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RecurrenceValidationError";
  }
}

// date-fns setDate expects 1–31; values here match that directly
export const DAY_OF_MONTH_OPTIONS = Array.from({ length: 31 }, (_, i) => ({
  label: (i + 1).toString(),
  value: i + 1,
}));

// date-fns Day: 0 = Sunday, 1 = Monday, ..., 6 = Saturday
export const DAY_OF_WEEK_OPTIONS = [
  { label: "Monday", value: 1 },
  { label: "Tuesday", value: 2 },
  { label: "Wednesday", value: 3 },
  { label: "Thursday", value: 4 },
  { label: "Friday", value: 5 },
  { label: "Saturday", value: 6 },
  { label: "Sunday", value: 0 },
] as const;

export const computeNextDueDate = ({
  recurrenceType,
  dayOfWeek,
  dayOfMonth,
  from = new Date(),
  timezone,
}: {
  recurrenceType: RecurrenceType;
  dayOfWeek?: number;
  dayOfMonth?: number;
  from?: Date;
  timezone: string;
}): Date => {
  if (recurrenceType === RecurrenceType.DAILY) {
    const zonedTime = toZonedTime(from, timezone);
    const updatedTime = addDays(startOfDay(zonedTime), 1);
    return fromZonedTime(updatedTime, timezone);
  } else if (recurrenceType === RecurrenceType.WEEKLY) {
    if (dayOfWeek === undefined) {
      throw new RecurrenceValidationError("BAD_REQUEST");
    }
    const zonedTime = toZonedTime(from, timezone);
    const updatedTime = startOfDay(nextDay(zonedTime, dayOfWeek as Day));
    return fromZonedTime(updatedTime, timezone);
  } else {
    if (dayOfMonth === undefined) {
      throw new RecurrenceValidationError("BAD_REQUEST");
    }
    const zonedTime = toZonedTime(from, timezone);
    const updatedTime = startOfDay(addMonths(setDate(zonedTime, dayOfMonth), 1));
    return fromZonedTime(updatedTime, timezone);
  }
};
