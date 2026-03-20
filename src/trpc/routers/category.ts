import { isOverdueInUserTz } from "@/lib/date-utils";
import { createCategorySchema, updateCategorySchema } from "@/lib/schemas";
import { ACTIVE_TASK_STATUSES } from "@/lib/task-utils";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/client";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { authedProcedure, createTRPCRouter } from "../init";

export const categoryRouter = createTRPCRouter({
  getAll: authedProcedure
    .input(z.object({ includeTasks: z.boolean().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const activeStatusFilter = { status: { in: [...ACTIVE_TASK_STATUSES] } };
      const categories = await ctx.db.category.findMany({
        where: { userId: ctx.currentUser.id },
        include: {
          _count: { select: { tasks: { where: activeStatusFilter } } },
          ...(input?.includeTasks
            ? {
                tasks: {
                  where: activeStatusFilter,
                  select: { dueDate: true },
                },
              }
            : {}),
        },
        orderBy: { name: "asc" },
      });

      return categories.map((category) => ({
        ...category,
        taskCount: category._count.tasks,
        overdueTaskCount: category.tasks?.filter((task) => task.dueDate && isOverdueInUserTz(task.dueDate, ctx.currentUser.userSettings.timezone)).length ?? 0,
      }));
    }),

  create: authedProcedure.input(createCategorySchema).mutation(async ({ ctx, input }) => {
    try {
      const category = await ctx.db.category.create({
        data: { name: input.name, color: input.color, userId: ctx.currentUser.id },
      });

      return category;
    } catch (err) {
      if (err instanceof PrismaClientKnownRequestError) {
        if (err.code === "P2002") {
          throw new TRPCError({ code: "CONFLICT" });
        }
      }

      throw err;
    }
  }),

  update: authedProcedure.input(updateCategorySchema).mutation(async ({ ctx, input }) => {
    try {
      const updatedCategory = await ctx.db.category.update({
        where: { id: input.categoryId, userId: ctx.currentUser.id },
        data: input.data,
      });

      return updatedCategory;
    } catch (err) {
      if (err instanceof PrismaClientKnownRequestError) {
        if (err.code === "P2025") {
          throw new TRPCError({ code: "NOT_FOUND" });
        } else if (err.code === "P2002") {
          throw new TRPCError({ code: "CONFLICT" });
        }
      }

      throw err;
    }
  }),

  delete: authedProcedure.input(z.object({ categoryId: z.cuid() })).mutation(async ({ ctx, input }) => {
    return await ctx.db.$transaction(async (tx) => {
      try {
        await tx.task.updateMany({ where: { categoryId: input.categoryId, userId: ctx.currentUser.id }, data: { categoryId: null } });

        const deletedCategory = await tx.category.delete({
          where: { id: input.categoryId, userId: ctx.currentUser.id },
        });

        return deletedCategory;
      } catch (err) {
        if (err instanceof PrismaClientKnownRequestError && err.code === "P2025") {
          throw new TRPCError({ code: "NOT_FOUND" });
        }

        throw err;
      }
    });
  }),
});
