import { RecurrenceType } from "@/generated/prisma/enums";
import { isBefore, startOfDay } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import z from "zod";

export type TaskSchemaMessages = {
  titleRequired: string;
  titleMaxLength: string;
  descriptionMaxLength: string;
  dueDateInPast: string;
  linkInvalid: string;
};

export type CategorySchemaMessages = {
  nameRequired: string;
  nameMaxLength: string;
};

export type RecurrenceSchemaMessages = {
  recurrenceDayRequired: string;
  recurrenceInvalidCombination: string;
};

function makeTaskBaseSchema(msgs?: Partial<TaskSchemaMessages>) {
  return z.object({
    title: z
      .string()
      .min(1, msgs?.titleRequired ?? "Title is required")
      .max(32, msgs?.titleMaxLength ?? "Title cannot be more than 32 characters long"),
    description: z
      .string()
      .max(100, msgs?.descriptionMaxLength ?? "Description cannot be more than 100 characters long")
      .optional(),
    dueDate: z.date().optional(),
    categoryId: z.cuid("Incorrectly formatted category ID"),
    externalContact: z.string().optional(),
    link: z.url(msgs?.linkInvalid ?? "Must be a valid URL").or(z.literal("")).optional(),
    timezone: z.string(),
  });
}

export function makeCreateTaskSchema(msgs?: Partial<TaskSchemaMessages>) {
  return makeTaskBaseSchema(msgs).superRefine((data, ctx) => {
    if (data.dueDate) {
      const zonedDue = toZonedTime(data.dueDate, data.timezone);
      const zonedNow = toZonedTime(new Date(), data.timezone);
      if (isBefore(startOfDay(zonedDue), startOfDay(zonedNow))) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["dueDate"],
          message: msgs?.dueDateInPast ?? "Due Date cannot be in the past",
        });
      }
    }
  });
}

export function makeUpdateTaskSchema(msgs?: Partial<TaskSchemaMessages>) {
  return z.object({ taskId: z.cuid(), data: makeTaskBaseSchema(msgs).partial() });
}

export function makeCategorySchema(msgs?: Partial<CategorySchemaMessages>) {
  return z.object({
    name: z
      .string()
      .min(1, msgs?.nameRequired ?? "Name is required")
      .max(30, msgs?.nameMaxLength ?? "Name cannot be more than 30 characters long"),
    color: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/, "Must be a valid hex color (e.g. #f59e0b)")
      .optional(),
  });
}

export function makeUpdateCategorySchema(msgs?: Partial<CategorySchemaMessages>) {
  return z.object({ categoryId: z.cuid(), data: makeCategorySchema(msgs).partial() });
}

function makeBaseRecurringTemplateSchema(msgs?: Partial<TaskSchemaMessages>) {
  return makeTaskBaseSchema(msgs)
    .extend({
      recurrenceType: z.enum(RecurrenceType),
      dayOfWeek: z.int().nonnegative().max(6).optional(),
      dayOfMonth: z.int().min(1).max(31).optional(),
    })
    .omit({ dueDate: true, timezone: true });
}

export function makeCreateRecurringTemplateSchema(msgs?: Partial<TaskSchemaMessages & RecurrenceSchemaMessages>) {
  return makeBaseRecurringTemplateSchema(msgs)
    .refine(
      (data) => data.recurrenceType === RecurrenceType.DAILY || !!data.dayOfMonth !== !!data.dayOfWeek,
      msgs?.recurrenceDayRequired ?? "Either Day of Week or Day of Month must be supplied",
    )
    .refine(
      (data) =>
        (data.recurrenceType === RecurrenceType.DAILY && !data.dayOfMonth && !data.dayOfWeek) ||
        (data.recurrenceType === RecurrenceType.MONTHLY && !!data.dayOfMonth) ||
        (data.recurrenceType === RecurrenceType.WEEKLY && !!data.dayOfWeek),
      msgs?.recurrenceInvalidCombination ?? "Invalid combination of Recurrence Type and DayOfWeek/DayOfMonth",
    );
}

export function makeUpdateRecurringTemplateSchema(msgs?: Partial<TaskSchemaMessages & RecurrenceSchemaMessages>) {
  return z.object({ templateId: z.cuid(), data: makeBaseRecurringTemplateSchema(msgs).partial() });
}

// Static defaults — used by TRPC routers and for type inference at call sites
export const createTaskSchema = makeCreateTaskSchema();
export const updateTaskSchema = makeUpdateTaskSchema();
export const createCategorySchema = makeCategorySchema();
export const updateCategorySchema = makeUpdateCategorySchema();
export const createRecurringTemplateSchema = makeCreateRecurringTemplateSchema();
export const updateRecurringTemplateSchema = makeUpdateRecurringTemplateSchema();
