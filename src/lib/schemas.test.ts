import { RecurrenceType } from "@/generated/prisma/enums";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeCategorySchema, makeCreateRecurringTemplateSchema, makeCreateTaskSchema } from "./schemas";

// A syntactically valid CUID for use as a required categoryId
const VALID_CUID = "clh3as75q0000sn8x93gr2a0g";

// ─── makeCreateTaskSchema ─────────────────────────────────────────────────────

describe("makeCreateTaskSchema", () => {
  const schema = makeCreateTaskSchema();

  it("accepts a minimal valid task", () => {
    expect(schema.safeParse({ title: "Buy groceries", categoryId: VALID_CUID, timezone: "UTC" }).success).toBe(true);
  });

  it("rejects an empty title", () => {
    expect(schema.safeParse({ title: "", categoryId: VALID_CUID, timezone: "UTC" }).success).toBe(false);
  });

  it("rejects a title longer than 32 characters", () => {
    expect(schema.safeParse({ title: "a".repeat(33), categoryId: VALID_CUID, timezone: "UTC" }).success).toBe(false);
  });

  it("accepts a title exactly at the 32-character limit", () => {
    expect(schema.safeParse({ title: "a".repeat(32), categoryId: VALID_CUID, timezone: "UTC" }).success).toBe(true);
  });

  it("rejects a description longer than 100 characters", () => {
    expect(
      schema.safeParse({ title: "Test", description: "x".repeat(101), categoryId: VALID_CUID, timezone: "UTC" })
        .success,
    ).toBe(false);
  });

  it("rejects an invalid URL for link", () => {
    expect(
      schema.safeParse({ title: "Test", link: "not-a-url", categoryId: VALID_CUID, timezone: "UTC" }).success,
    ).toBe(false);
  });

  it("accepts an empty string for link (clearing the field)", () => {
    expect(schema.safeParse({ title: "Test", link: "", categoryId: VALID_CUID, timezone: "UTC" }).success).toBe(true);
  });

  it("accepts a valid HTTPS URL for link", () => {
    expect(
      schema.safeParse({ title: "Test", link: "https://example.com", categoryId: VALID_CUID, timezone: "UTC" })
        .success,
    ).toBe(true);
  });

  it("rejects an invalid categoryId", () => {
    expect(schema.safeParse({ title: "Test", categoryId: "not-a-cuid", timezone: "UTC" }).success).toBe(false);
  });

  describe("dueDate validation", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2024-06-15T10:00:00Z"));
    });
    afterEach(() => vi.useRealTimers());

    it("accepts a dueDate that is today (not in the past)", () => {
      expect(
        schema.safeParse({ title: "Test", categoryId: VALID_CUID, timezone: "UTC", dueDate: new Date("2024-06-15") })
          .success,
      ).toBe(true);
    });

    it("accepts a dueDate in the future", () => {
      expect(
        schema.safeParse({ title: "Test", categoryId: VALID_CUID, timezone: "UTC", dueDate: new Date("2024-06-20") })
          .success,
      ).toBe(true);
    });

    it("rejects a dueDate in the past", () => {
      expect(
        schema.safeParse({ title: "Test", categoryId: VALID_CUID, timezone: "UTC", dueDate: new Date("2024-06-14") })
          .success,
      ).toBe(false);
    });
  });
});

// ─── makeCategorySchema ───────────────────────────────────────────────────────

describe("makeCategorySchema", () => {
  const schema = makeCategorySchema();

  it("accepts a valid category with just a name", () => {
    expect(schema.safeParse({ name: "Work" }).success).toBe(true);
  });

  it("rejects an empty name", () => {
    expect(schema.safeParse({ name: "" }).success).toBe(false);
  });

  it("rejects a name longer than 30 characters", () => {
    expect(schema.safeParse({ name: "a".repeat(31) }).success).toBe(false);
  });

  it("accepts a valid 6-digit hex color", () => {
    expect(schema.safeParse({ name: "Work", color: "#3b82f6" }).success).toBe(true);
    expect(schema.safeParse({ name: "Work", color: "#FFFFFF" }).success).toBe(true);
  });

  it("rejects a color without a leading #", () => {
    expect(schema.safeParse({ name: "Work", color: "3b82f6" }).success).toBe(false);
  });

  it("rejects a 3-character shorthand hex color", () => {
    expect(schema.safeParse({ name: "Work", color: "#f00" }).success).toBe(false);
  });

  it("rejects non-hex characters in the color value", () => {
    expect(schema.safeParse({ name: "Work", color: "#zzzzzz" }).success).toBe(false);
  });
});

// ─── makeCreateRecurringTemplateSchema ───────────────────────────────────────

describe("makeCreateRecurringTemplateSchema", () => {
  const schema = makeCreateRecurringTemplateSchema();
  const base = { title: "Weekly task", categoryId: VALID_CUID, timezone: "UTC" };

  it("accepts DAILY recurrence without any day field", () => {
    expect(schema.safeParse({ ...base, recurrenceType: RecurrenceType.DAILY }).success).toBe(true);
  });

  it("accepts WEEKLY recurrence with dayOfWeek", () => {
    expect(
      schema.safeParse({ ...base, recurrenceType: RecurrenceType.WEEKLY, dayOfWeek: 1 }).success,
    ).toBe(true);
  });

  it("accepts MONTHLY recurrence with dayOfMonth", () => {
    expect(
      schema.safeParse({ ...base, recurrenceType: RecurrenceType.MONTHLY, dayOfMonth: 15 }).success,
    ).toBe(true);
  });

  it("rejects WEEKLY without dayOfWeek", () => {
    expect(schema.safeParse({ ...base, recurrenceType: RecurrenceType.WEEKLY }).success).toBe(false);
  });

  it("rejects MONTHLY without dayOfMonth", () => {
    expect(schema.safeParse({ ...base, recurrenceType: RecurrenceType.MONTHLY }).success).toBe(false);
  });

  it("rejects DAILY with a dayOfWeek supplied", () => {
    expect(
      schema.safeParse({ ...base, recurrenceType: RecurrenceType.DAILY, dayOfWeek: 1 }).success,
    ).toBe(false);
  });

  it("rejects DAILY with a dayOfMonth supplied", () => {
    expect(
      schema.safeParse({ ...base, recurrenceType: RecurrenceType.DAILY, dayOfMonth: 15 }).success,
    ).toBe(false);
  });

  it("rejects WEEKLY with dayOfMonth instead of dayOfWeek", () => {
    expect(
      schema.safeParse({ ...base, recurrenceType: RecurrenceType.WEEKLY, dayOfMonth: 15 }).success,
    ).toBe(false);
  });

  it("rejects MONTHLY with dayOfWeek instead of dayOfMonth", () => {
    expect(
      schema.safeParse({ ...base, recurrenceType: RecurrenceType.MONTHLY, dayOfWeek: 1 }).success,
    ).toBe(false);
  });

  it("uses custom error messages when provided", () => {
    const customSchema = makeCreateRecurringTemplateSchema({
      recurrenceDayRequired: "Custom day error",
    });
    const result = customSchema.safeParse({ ...base, recurrenceType: RecurrenceType.WEEKLY });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain("Custom day error");
    }
  });
});
