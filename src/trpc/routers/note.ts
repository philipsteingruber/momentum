import { PrismaClientKnownRequestError } from "@prisma/client/runtime/client";
import { TRPCError } from "@trpc/server";
import z from "zod";
import { authedProcedure, createTRPCRouter } from "../init";

export const noteRouter = createTRPCRouter({
  getByTaskId: authedProcedure.input(z.object({ taskId: z.cuid() })).query(async ({ ctx, input }) => {
    const task = await ctx.db.task.findUnique({
      where: { id: input.taskId, userId: ctx.currentUser.id },
      include: { notes: true },
    });

    if (!task) {
      throw new TRPCError({ code: "NOT_FOUND" });
    }

    return task.notes;
  }),

  create: authedProcedure
    .input(z.object({ content: z.string().min(1), taskId: z.cuid() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const task = await ctx.db.task.findUnique({ where: { userId: ctx.currentUser.id, id: input.taskId } });
        if (!task) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }

        return await ctx.db.note.create({ data: { content: input.content, taskId: input.taskId } });
      } catch (err) {
        if (err instanceof PrismaClientKnownRequestError && err.code === "P2025") {
          throw new TRPCError({ code: "NOT_FOUND" });
        }

        throw err;
      }
    }),

  delete: authedProcedure.input(z.object({ noteId: z.cuid() })).mutation(async ({ ctx, input }) => {
    try {
      return await ctx.db.note.delete({ where: { id: input.noteId, task: { userId: ctx.currentUser.id } } });
    } catch (err) {
      if (err instanceof PrismaClientKnownRequestError && err.code === "P2025") {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      throw err;
    }
  }),
});
