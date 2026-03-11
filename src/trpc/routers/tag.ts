import { PrismaClientKnownRequestError } from "@prisma/client/runtime/client";
import { TRPCError } from "@trpc/server";
import z from "zod";
import { authedProcedure, createTRPCRouter } from "../init";

export const tagRouter = createTRPCRouter({
  getAll: authedProcedure.query(async ({ ctx }) => {
    return await ctx.db.tag.findMany({ where: { userId: ctx.currentUser.id } });
  }),

  create: authedProcedure
    .input(z.object({ name: z.string().min(1), color: z.hex().optional() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const createdProcedure = await ctx.db.tag.create({
          data: { name: input.name, color: input.color, userId: ctx.currentUser.id },
        });

        return createdProcedure;
      } catch (err) {
        if (err instanceof PrismaClientKnownRequestError && err.code === "P2002") {
          throw new TRPCError({ code: "CONFLICT" });
        }

        throw err;
      }
    }),

  update: authedProcedure
    .input(z.object({ tagId: z.cuid(), data: z.object({ name: z.string().min(1), color: z.hex() }).partial() }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await ctx.db.tag.update({
          where: { id: input.tagId, userId: ctx.currentUser.id },
          data: input.data,
        });
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

  delete: authedProcedure.input(z.object({ tagId: z.cuid() })).mutation(async ({ ctx, input }) => {
    try {
      return await ctx.db.tag.delete({ where: { id: input.tagId, userId: ctx.currentUser.id } });
    } catch (err) {
      if (err instanceof PrismaClientKnownRequestError && err.code === "P2025") {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      throw err;
    }
  }),

  assignToTask: authedProcedure
    .input(z.object({ tagId: z.cuid(), taskId: z.cuid() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const task = await ctx.db.task.findUnique({ where: { id: input.taskId, userId: ctx.currentUser.id } });
        if (!task) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }

        return await ctx.db.tag.update({
          where: { id: input.tagId, userId: ctx.currentUser.id },
          data: { tasks: { connect: { id: input.taskId } } },
        });
      } catch (err) {
        if (err instanceof PrismaClientKnownRequestError && err.code === "P2025") {
          throw new TRPCError({ code: "NOT_FOUND" });
        }

        throw err;
      }
    }),

  removeFromTask: authedProcedure
    .input(z.object({ tagId: z.cuid(), taskId: z.cuid() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const task = await ctx.db.task.findUnique({ where: { id: input.taskId, userId: ctx.currentUser.id } });
        if (!task) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }

        return await ctx.db.tag.update({
          where: { id: input.tagId, userId: ctx.currentUser.id },
          data: { tasks: { disconnect: { id: input.taskId } } },
        });
      } catch (err) {
        if (err instanceof PrismaClientKnownRequestError && err.code === "P2025") {
          throw new TRPCError({ code: "NOT_FOUND" });
        }

        throw err;
      }
    }),
});
