import { TaskStatus } from "@/generated/prisma/enums";
import { computeNextDueDate } from "@/lib/recurring-template-utils";
import { createRecurringTemplateSchema, updateRecurringTemplateSchema } from "@/lib/schemas";
import { TRPCError } from "@trpc/server";
import z from "zod";
import { authedProcedure, createTRPCRouter } from "../init";

export const recurringTemplateRouter = createTRPCRouter({
  getAll: authedProcedure.query(async ({ ctx }) => {
    return await ctx.db.recurringTemplate.findMany({ where: { userId: ctx.currentUser.id } });
  }),

  getById: authedProcedure.input(z.object({ templateId: z.cuid() })).query(async ({ ctx, input }) => {
    const template = await ctx.db.recurringTemplate.findUnique({
      where: { id: input.templateId, userId: ctx.currentUser.id },
    });

    if (!template) {
      throw new TRPCError({ code: "NOT_FOUND" });
    }

    return template;
  }),

  create: authedProcedure.input(createRecurringTemplateSchema).mutation(async ({ ctx, input }) => {
    return await ctx.db.recurringTemplate.create({
      data: { ...input, userId: ctx.currentUser.id, nextDueDate: computeNextDueDate(input) },
    });
  }),

  update: authedProcedure.input(updateRecurringTemplateSchema).mutation(async ({ ctx, input }) => {
    const existing = await ctx.db.recurringTemplate.findUnique({
      where: { id: input.templateId, userId: ctx.currentUser.id },
    });

    if (!existing) {
      throw new TRPCError({ code: "NOT_FOUND" });
    }

    try {
      const nextDueDate =
        input.data.recurrenceType !== undefined ||
        input.data.dayOfWeek !== undefined ||
        input.data.dayOfMonth !== undefined
          ? computeNextDueDate({
              recurrenceType: input.data.recurrenceType ?? existing.recurrenceType,
              dayOfWeek: input.data.dayOfWeek ?? existing.dayOfWeek ?? undefined,
              dayOfMonth: input.data.dayOfMonth ?? existing.dayOfMonth ?? undefined,
            })
          : existing.nextDueDate;

      return await ctx.db.recurringTemplate.update({
        where: { id: input.templateId, userId: ctx.currentUser.id },
        data: { ...input.data, nextDueDate: nextDueDate },
      });
    } catch (err) {
      if (err instanceof Error && err.message === "BAD_REQUEST") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid recurrence type and day combination" });
      }
      throw err;
    }
  }),

  delete: authedProcedure.input(z.object({ templateId: z.cuid() })).mutation(async ({ ctx, input }) => {
    await ctx.db.$transaction(async (tx) => {
      await tx.task.deleteMany({
        where: {
          recurringTemplateId: input.templateId,
          userId: ctx.currentUser.id,
          status: { in: [TaskStatus.PENDING, TaskStatus.IN_PROGRESS, TaskStatus.BLOCKED] },
        },
      });
      await tx.task.updateMany({
        where: {
          recurringTemplateId: input.templateId,
          userId: ctx.currentUser.id,
          status: { in: [TaskStatus.COMPLETED, TaskStatus.CANCELLED, TaskStatus.SKIPPED] },
        },
        data: { recurringTemplateId: null },
      });
      await tx.recurringTemplate.delete({ where: { id: input.templateId, userId: ctx.currentUser.id } });
    });
  }),
});
