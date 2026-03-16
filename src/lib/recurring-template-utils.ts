import type { Day } from "date-fns";
import { addDays, addMonths, nextDay, setDate, startOfDay } from "date-fns";
import { RecurrenceType } from "./../generated/prisma/enums";

export const computeNextDueDate = ({
  recurrenceType,
  dayOfWeek,
  dayOfMonth,
}: {
  recurrenceType: RecurrenceType;
  dayOfWeek?: number;
  dayOfMonth?: number;
}): Date => {
  if (recurrenceType === RecurrenceType.DAILY) {
    return addDays(startOfDay(new Date()), 1);
  } else if (recurrenceType === RecurrenceType.WEEKLY) {
    if (dayOfWeek === undefined) {
      throw new Error("BAD_REQUEST");
    }
    return nextDay(new Date(), dayOfWeek as Day);
  } else {
    if (dayOfMonth === undefined) {
      throw new Error("BAD_REQUEST");
    }
    return addMonths(setDate(new Date(), dayOfMonth), 1);
  }
};
