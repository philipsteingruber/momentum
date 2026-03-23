import { RecurrenceType } from "@/generated/prisma/enums";
import { describe, expect, it } from "vitest";
import { RecurrenceValidationError, computeNextDueDate } from "./recurring-template-utils";

// All tests use Europe/Stockholm (UTC+2 in summer) so we can assert exact UTC timestamps.

const TZ = "Europe/Stockholm";
// Reference "from" date: Saturday 2024-06-15 10:00 UTC = 12:00 Stockholm
const FROM = new Date("2024-06-15T10:00:00Z");

describe("computeNextDueDate", () => {
  describe("DAILY recurrence", () => {
    it("returns midnight of the next calendar day in the given timezone", () => {
      // startOfDay(June 15 Stockholm) + 1 day = June 16 00:00 Stockholm = June 15 22:00 UTC
      const result = computeNextDueDate({ recurrenceType: RecurrenceType.DAILY, from: FROM, timezone: TZ });
      expect(result.toISOString()).toBe("2024-06-15T22:00:00.000Z");
    });

    it("works correctly across a DST boundary", () => {
      // March 31 is the last day before European DST switch (clocks go forward on March 31)
      const winterDate = new Date("2024-03-30T10:00:00Z"); // UTC+1 (CET)
      const result = computeNextDueDate({ recurrenceType: RecurrenceType.DAILY, from: winterDate, timezone: TZ });
      // March 31 00:00 Stockholm (UTC+1) = March 30 23:00 UTC
      expect(result.toISOString()).toBe("2024-03-30T23:00:00.000Z");
    });
  });

  describe("WEEKLY recurrence", () => {
    it("returns the next occurrence of the given weekday, preserving the time component", () => {
      // From: Saturday June 15 12:00 Stockholm. Next Monday = June 17 12:00 Stockholm = June 17 10:00 UTC
      const result = computeNextDueDate({
        recurrenceType: RecurrenceType.WEEKLY,
        dayOfWeek: 1, // Monday
        from: FROM,
        timezone: TZ,
      });
      expect(result.toISOString()).toBe("2024-06-17T10:00:00.000Z");
    });

    it("skips to next week if from date is already the target weekday", () => {
      // From: Monday June 10, next Monday = June 17
      const monday = new Date("2024-06-10T10:00:00Z");
      const result = computeNextDueDate({
        recurrenceType: RecurrenceType.WEEKLY,
        dayOfWeek: 1,
        from: monday,
        timezone: TZ,
      });
      // June 17 12:00 Stockholm = June 17 10:00 UTC
      expect(result.toISOString()).toBe("2024-06-17T10:00:00.000Z");
    });

    it("throws RecurrenceValidationError when dayOfWeek is not provided", () => {
      expect(() =>
        computeNextDueDate({ recurrenceType: RecurrenceType.WEEKLY, from: FROM, timezone: TZ }),
      ).toThrow(RecurrenceValidationError);
    });
  });

  describe("MONTHLY recurrence", () => {
    it("returns the same day-of-month next month, preserving the time component", () => {
      // From: June 15 12:00 Stockholm. dayOfMonth: 15 → July 15 12:00 Stockholm = July 15 10:00 UTC
      const result = computeNextDueDate({
        recurrenceType: RecurrenceType.MONTHLY,
        dayOfMonth: 15,
        from: FROM,
        timezone: TZ,
      });
      expect(result.toISOString()).toBe("2024-07-15T10:00:00.000Z");
    });

    it("can target a different day of the month", () => {
      // From: June 15. dayOfMonth: 1 → July 1
      const result = computeNextDueDate({
        recurrenceType: RecurrenceType.MONTHLY,
        dayOfMonth: 1,
        from: FROM,
        timezone: TZ,
      });
      // July 1 12:00 Stockholm = July 1 10:00 UTC
      expect(result.toISOString()).toBe("2024-07-01T10:00:00.000Z");
    });

    it("throws RecurrenceValidationError when dayOfMonth is not provided", () => {
      expect(() =>
        computeNextDueDate({ recurrenceType: RecurrenceType.MONTHLY, from: FROM, timezone: TZ }),
      ).toThrow(RecurrenceValidationError);
    });
  });
});
