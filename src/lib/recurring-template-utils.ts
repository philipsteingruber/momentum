import type { Day } from "date-fns";
import { addDays, addMonths, nextDay, setDate, startOfDay } from "date-fns";
import { RecurrenceType } from "./../generated/prisma/enums";

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
}: {
  recurrenceType: RecurrenceType;
  dayOfWeek?: number;
  dayOfMonth?: number;
  from?: Date;
}): Date => {
  if (recurrenceType === RecurrenceType.DAILY) {
    return addDays(startOfDay(from), 1);
  } else if (recurrenceType === RecurrenceType.WEEKLY) {
    if (dayOfWeek === undefined) {
      throw new Error("BAD_REQUEST");
    }
    return nextDay(from, dayOfWeek as Day);
  } else {
    if (dayOfMonth === undefined) {
      throw new Error("BAD_REQUEST");
    }
    return addMonths(setDate(from, dayOfMonth), 1);
  }
};
