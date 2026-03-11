import { TaskStatus } from "@/generated/prisma/enums";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/client";
import { TRPCError } from "@trpc/server";
import { isAfter } from "date-fns";
import { z } from "zod";
import { authedProcedure, createTRPCRouter } from "../init";

export const taskRouter = createTRPCRouter({
  getAllTasks: authedProcedure
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
      const tasks = await ctx.db.task.findMany({
        where: {
          userId: ctx.currentUser.id,
          status: input.status,
          dueDate: { gte: input.dueDateRange?.start, lte: input.dueDateRange?.end },
          title: { contains: input.search, mode: "insensitive" },
          categoryId: input.categoryId,
        },
      });

      return tasks;
    }),

  getById: authedProcedure.input(z.object({ taskId: z.cuid() })).query(async ({ ctx, input }) => {
    const task = await ctx.db.task.findUnique({
      where: { id: input.taskId, userId: ctx.currentUser.id },
      include: { notes: true },
    });

    if (!task) {
      throw new TRPCError({ code: "NOT_FOUND" });
    }

    return task;
  }),

  create: authedProcedure
    .input(
      z.object({
        title: z.string().min(1, "Title is required"),
        description: z.string().optional(),
        dueDate: z
          .date()
          .refine((date) => isAfter(date, new Date()))
          .optional(),
        categoryId: z.cuid().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const newTask = await ctx.db.task.create({
        data: {
          title: input.title,
          description: input.description,
          dueDate: input.dueDate,
          categoryId: input.categoryId ?? null,
          userId: ctx.currentUser.id,
        },
      });

      return newTask;
    }),

  update: authedProcedure
    .input(
      z.object({
        taskId: z.cuid(),
        data: z
          .object({
            title: z.string().min(1),
            description: z.string(),
            dueDate: z.date().refine((date) => isAfter(date, new Date())),
            categoryId: z.cuid(),
          })
          .partial(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
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
      try {
        const updatedTask = await ctx.db.task.update({
          where: { id: input.taskId, userId: ctx.currentUser.id },
          data: { status: input.newStatus },
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
});
