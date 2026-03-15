import { isAfter } from "date-fns";
import z from "zod";

export const createTaskSchema = z.object({
  title: z.string().min(1, "Title is required").max(32, "Title cannot be more than 32 characters long"),
  description: z.string().max(100, "Description cannot be more than 100 characters long").optional(),
  dueDate: z
    .date()
    .refine((date) => isAfter(date, new Date()), "Due Date must be in the future")
    .optional(),
  categoryId: z.cuid("Incorrectly formatted category ID").optional(),
  externalContact: z.string().optional(),
  link: z.url().optional(),
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
