import { isBefore, startOfDay } from "date-fns";
import z from "zod";

export const createTaskSchema = z.object({
  title: z.string().min(1, "Title is required").max(32, "Title cannot be more than 32 characters long"),
  description: z.string().max(100, "Description cannot be more than 100 characters long").optional(),
  dueDate: z
    .date()
    .refine((date) => !isBefore(startOfDay(date), startOfDay(new Date())), "Due Date cannot be in the past")
    .optional(),
  categoryId: z.cuid("Incorrectly formatted category ID").optional(),
  externalContact: z.string().optional(),
  link: z.url("Must be a valid URL").or(z.literal("")).optional(),
});
export const updateTaskSchema = z.object({ taskId: z.cuid(), data: createTaskSchema.partial() });

export const createCategorySchema = z.object({
  name: z.string().min(1, "Name is required").max(30, "Name cannot be more than 30 characters long"),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Must be a valid hex color (e.g. #f59e0b)")
    .optional(),
});
export const updateCategorySchema = z.object({ categoryId: z.cuid(), data: createCategorySchema.partial() });
