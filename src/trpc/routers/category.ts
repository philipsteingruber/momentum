import { PrismaClientKnownRequestError } from "@prisma/client/runtime/client";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { authedProcedure, createTRPCRouter } from "../init";

export const categoryRouter = createTRPCRouter({
  getAll: authedProcedure.query(async ({ ctx }) => {
    const categories = await ctx.db.category.findMany({
      where: { userId: ctx.currentUser.id },
      include: { _count: { select: { tasks: true } } },
    });

    return categories.map((category) => ({ ...category, taskCount: category._count.tasks }));
  }),

  create: authedProcedure
    .input(z.object({ name: z.string().min(1), color: z.hex().optional() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const category = await ctx.db.category.create({
          data: { name: input.name, color: input.color, userId: ctx.currentUser.id },
        });

        return category;
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

  update: authedProcedure
    .input(z.object({ categoryId: z.cuid(), data: z.object({ name: z.string().min(1), color: z.hex() }).partial() }))
    .mutation(async ({ ctx, input }) => {
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
        await tx.task.updateMany({ where: { categoryId: input.categoryId }, data: { categoryId: null } });

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
