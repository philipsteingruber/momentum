import { RecurrenceType, TaskStatus } from "@/generated/prisma/enums";
import { computeNextMondayDueDate, computeSnoozeDueDate } from "@/lib/date-utils";
import { createTaskSchema, updateTaskSchema } from "@/lib/schemas";
import { TERMINAL_TASK_STATUSES } from "@/lib/task-utils";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/client";
import { TRPCError } from "@trpc/server";
import { addDays, subDays } from "date-fns";
import { z } from "zod";
import { authedProcedure, type AuthedContext, createTRPCRouter } from "../init";

async function executeSnooze(
  ctx: AuthedContext,
  taskId: string,
  computeNewDate: (dueDate: Date, timezone: string) => Date,
) {
  const timezone = ctx.currentUser.userSettings.timezone;
  const task = await ctx.db.task.findUnique({
    where: { id: taskId, userId: ctx.currentUser.id },
    include: { recurringTemplate: { select: { recurrenceType: true } } },
  });

  if (!task) throw new TRPCError({ code: "NOT_FOUND" });
  if (!task.dueDate) throw new TRPCError({ code: "PRECONDITION_FAILED" });

  if (task.recurringTemplate?.recurrenceType === RecurrenceType.DAILY) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Daily recurring tasks cannot be snoozed" });
  }

  const newDueDate = computeNewDate(task.dueDate, timezone);

  if (task.recurringTemplateId) {
    return await ctx.db.$transaction(async (tx) => {
      const updatedTask = await tx.task.update({
        where: { id: taskId, userId: ctx.currentUser.id },
        data: { dueDate: newDueDate },
      });
      await tx.recurringTemplate.update({
        where: { id: task.recurringTemplateId! },
        data: { snoozeCount: { increment: 1 }, nextGenerateOn: addDays(newDueDate, 1) },
      });
      return updatedTask;
    });
  }

  return await ctx.db.task.update({
    where: { id: taskId, userId: ctx.currentUser.id },
    data: { dueDate: newDueDate },
  });
}

export const taskRouter = createTRPCRouter({
  getAll: authedProcedure
    .input(
      z
        .object({
          status: z.enum(TaskStatus),
          categoryId: z.cuid(),
          dueDateRange: z.object({ start: z.date(), end: z.date() }),
          search: z.string(),
        })
        .partial(),
    )
    .query(async ({ ctx, input }) => {
      const cutoff = subDays(new Date(), 14);

      const tasks = await ctx.db.task.findMany({
        where: {
          userId: ctx.currentUser.id,
          status: input.status ? { equals: input.status, not: TaskStatus.SKIPPED } : { not: TaskStatus.SKIPPED },
          dueDate: { gte: input.dueDateRange?.start, lte: input.dueDateRange?.end },
          title: { contains: input.search, mode: "insensitive" },
          categoryId: input.categoryId,
          NOT: {
            AND: [
              { status: { in: [...TERMINAL_TASK_STATUSES] } },
              { OR: [{ completedAt: { lt: cutoff } }, { completedAt: null }] },
            ],
          },
        },
        include: {
          notes: true,
          tags: true,
          recurringTemplate: { select: { recurrenceType: true } },
        },
        orderBy: { createdAt: "asc" },
      });

      const latestByTemplate = new Map<string, { id: string; ts: number }>();
      for (const task of tasks) {
        if (task.recurringTemplateId && (TERMINAL_TASK_STATUSES as readonly TaskStatus[]).includes(task.status)) {
          const ts = task.createdAt.getTime();
          const existing = latestByTemplate.get(task.recurringTemplateId);
          if (!existing || ts > existing.ts) {
            latestByTemplate.set(task.recurringTemplateId, { id: task.id, ts });
          }
        }
      }

      return tasks.filter((task) => {
        if (!task.recurringTemplateId || !(TERMINAL_TASK_STATUSES as readonly TaskStatus[]).includes(task.status)) {
          return true;
        }
        return latestByTemplate.get(task.recurringTemplateId)?.id === task.id;
      });
    }),

  getById: authedProcedure.input(z.object({ taskId: z.cuid() })).query(async ({ ctx, input }) => {
    const task = await ctx.db.task.findUnique({
      where: { id: input.taskId, userId: ctx.currentUser.id },
      include: {
        notes: { orderBy: { createdAt: "desc" } },
        category: true,
        recurringTemplate: { select: { recurrenceType: true } },
      },
    });

    if (!task) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "This task doesn't exist or you don't have access to see it.",
      });
    }

    return task;
  }),

  create: authedProcedure.input(createTaskSchema).mutation(async ({ ctx, input }) => {
    const newTask = await ctx.db.task.create({
      data: {
        title: input.title,
        description: input.description,
        dueDate: input.dueDate,
        categoryId: input.categoryId,
        externalContact: input.externalContact || null,
        link: input.link || null,
        userId: ctx.currentUser.id,
      },
    });

    return newTask;
  }),

  update: authedProcedure.input(updateTaskSchema).mutation(async ({ ctx, input }) => {
    try {
      const { timezone: _tz, ...taskData } = input.data;
      const updatedTask = await ctx.db.task.update({
        where: { id: input.taskId, userId: ctx.currentUser.id },
        data: taskData,
      });

      return updatedTask;
    } catch (err) {
      if (err instanceof PrismaClientKnownRequestError && err.code === "P2025") {
        throw new TRPCError({ code: "NOT_FOUND" });
      } else {
        throw err;
      }
    }
  }),

  updateStatus: authedProcedure
    .input(z.object({ taskId: z.cuid(), newStatus: z.enum(TaskStatus) }))
    .mutation(async ({ ctx, input }) => {
      const isTerminal = (TERMINAL_TASK_STATUSES as readonly TaskStatus[]).includes(input.newStatus);

      try {
        const updatedTask = await ctx.db.task.update({
          where: { id: input.taskId, userId: ctx.currentUser.id },
          data: {
            status: input.newStatus,
            completedAt: isTerminal ? new Date() : null,
          },
        });

        return updatedTask;
      } catch (err) {
        if (err instanceof PrismaClientKnownRequestError && err.code === "P2025") {
          throw new TRPCError({ code: "NOT_FOUND" });
        } else {
          throw err;
        }
      }
    }),

  delete: authedProcedure.input(z.object({ taskId: z.cuid() })).mutation(async ({ ctx, input }) => {
    try {
      const deletedTask = await ctx.db.task.delete({ where: { id: input.taskId, userId: ctx.currentUser.id } });

      return deletedTask;
    } catch (err) {
      if (err instanceof PrismaClientKnownRequestError && err.code === "P2025") {
        throw new TRPCError({ code: "NOT_FOUND" });
      } else {
        throw err;
      }
    }
  }),

  snooze: authedProcedure
    .input(z.object({ taskId: z.cuid(), days: z.int().min(1) }))
    .mutation(({ ctx, input }) =>
      executeSnooze(ctx, input.taskId, (dueDate, tz) => computeSnoozeDueDate(dueDate, input.days, tz)),
    ),

  snoozeToNextMonday: authedProcedure
    .input(z.object({ taskId: z.cuid() }))
    .mutation(({ ctx, input }) =>
      executeSnooze(ctx, input.taskId, (_dueDate, tz) => computeNextMondayDueDate(tz)),
    ),
});
