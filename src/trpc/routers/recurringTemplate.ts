import { TaskStatus } from "@/generated/prisma/enums";
import { computeNextDueDate, RecurrenceValidationError } from "@/lib/recurring-template-utils";
import { ACTIVE_TASK_STATUSES } from "@/lib/task-utils";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/client";
import { createRecurringTemplateSchema, updateRecurringTemplateSchema } from "@/lib/schemas";
import { TRPCError } from "@trpc/server";
import { endOfDayInTz } from "@/lib/date-utils";
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

  getHistory: authedProcedure.input(z.object({ templateId: z.cuid() })).query(async ({ ctx, input }) => {
    const timezone = ctx.currentUser.userSettings.timezone;
    const tasks = await ctx.db.task.findMany({
      where: {
        recurringTemplateId: input.templateId,
        userId: ctx.currentUser.id,
        status: { in: [TaskStatus.COMPLETED, TaskStatus.CANCELLED, TaskStatus.SKIPPED] },
      },
      orderBy: { dueDate: "desc" },
      take: 10,
      select: { id: true, status: true, dueDate: true, completedAt: true, _count: { select: { notes: true } } },
    });

    return tasks.map(({ _count, ...task }) => ({
      ...task,
      hasNotes: _count.notes > 0,
      isOnTime:
        task.status === TaskStatus.COMPLETED && task.dueDate && task.completedAt
          ? task.completedAt <= endOfDayInTz(task.dueDate, timezone)
          : null,
    }));
  }),

  create: authedProcedure.input(createRecurringTemplateSchema).mutation(async ({ ctx, input }) => {
    const { timezone } = ctx.currentUser.userSettings;
    const firstDueDate = computeNextDueDate({ ...input, timezone });

    return await ctx.db.$transaction(async (tx) => {
      const template = await tx.recurringTemplate.create({
        data: { ...input, userId: ctx.currentUser.id, nextDueDate: firstDueDate },
      });

      await tx.task.create({
        data: {
          title: input.title,
          categoryId: input.categoryId,
          link: input.link,
          description: input.description,
          externalContact: input.externalContact,
          userId: ctx.currentUser.id,
          dueDate: firstDueDate,
          recurringTemplateId: template.id,
        },
      });

      return template;
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
      const scheduleChanged =
        input.data.recurrenceType !== undefined ||
        input.data.dayOfWeek !== undefined ||
        input.data.dayOfMonth !== undefined;

      const nextDueDate = scheduleChanged
        ? computeNextDueDate({
            recurrenceType: input.data.recurrenceType ?? existing.recurrenceType,
            dayOfWeek: input.data.dayOfWeek ?? existing.dayOfWeek ?? undefined,
            dayOfMonth: input.data.dayOfMonth ?? existing.dayOfMonth ?? undefined,
            timezone: ctx.currentUser.userSettings.timezone,
          })
        : existing.nextDueDate;

      return await ctx.db.$transaction(async (tx) => {
        if (scheduleChanged) {
          await tx.task.updateMany({
            where: {
              recurringTemplateId: input.templateId,
              userId: ctx.currentUser.id,
              status: { in: [...ACTIVE_TASK_STATUSES] },
            },
            data: { status: TaskStatus.CANCELLED },
          });
          await tx.task.create({
            data: {
              title: input.data.title ?? existing.title,
              description: input.data.description ?? existing.description,
              externalContact: input.data.externalContact ?? existing.externalContact,
              categoryId: input.data.categoryId ?? existing.categoryId,
              link: input.data.link ?? existing.link,
              userId: ctx.currentUser.id,
              dueDate: nextDueDate,
              recurringTemplateId: input.templateId,
            },
          });
        }

        return await tx.recurringTemplate.update({
          where: { id: input.templateId, userId: ctx.currentUser.id },
          data: { ...input.data, nextDueDate, ...(scheduleChanged && { snoozeCount: 0 }) },
        });
      });
    } catch (err) {
      if (err instanceof PrismaClientKnownRequestError && err.code === "P2025") {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      if (err instanceof RecurrenceValidationError) {
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
          status: { in: [...ACTIVE_TASK_STATUSES] },
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
