import { isAfter } from "date-fns";
import z from "zod";

export const createTaskSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .min(5, "Title must be at least 5 characters long")
    .max(32, "Title cannot be more than 32 characters long"),
  description: z.string().max(100, "Description cannot be more than 100 characters long").optional(),
  dueDate: z
    .date()
    .refine((date) => isAfter(date, new Date()), "Due Date must be in the future")
    .optional(),
  categoryId: z.cuid("Incorrectly formatted category ID").optional(),
});

export const updateTaskSchema = z.object({ taskId: z.cuid(), data: z.object(createTaskSchema.partial()) });
