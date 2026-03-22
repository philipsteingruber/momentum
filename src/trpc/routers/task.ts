import { TaskStatus } from "@/generated/prisma/enums";
import { createTaskSchema, updateTaskSchema } from "@/lib/schemas";
import { TERMINAL_TASK_STATUSES } from "@/lib/task-utils";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/client";
import { TRPCError } from "@trpc/server";
import { addDays, subDays } from "date-fns";
import { z } from "zod";
import { authedProcedure, createTRPCRouter } from "../init";

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
      include: { notes: { orderBy: { createdAt: "desc" } }, category: true },
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
      const updatedTask = await ctx.db.task.update({
        where: { id: input.taskId, userId: ctx.currentUser.id },
        data: input.data,
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
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.$transaction(async (tx) => {
        const task = await tx.task.findUnique({ where: { id: input.taskId, userId: ctx.currentUser.id } });

        if (!task) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }
        if (!task.dueDate) {
          throw new TRPCError({ code: "PRECONDITION_FAILED" });
        }

        return await tx.task.update({
          where: { id: input.taskId, userId: ctx.currentUser.id },
          data: { dueDate: addDays(task.dueDate, input.days) },
        });
      });
    }),
});
