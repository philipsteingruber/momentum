import { GrantStatus, TaskStatus } from "@/generated/prisma/enums";
import { TERMINAL_TASK_STATUSES } from "@/lib/task-utils";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/client";
import { TRPCError } from "@trpc/server";
import { subDays } from "date-fns";
import { z } from "zod";
import { type AuthedContext, authedProcedure, createTRPCRouter } from "../init";

/**
 * Use for shared data reads that do NOT need category filtering (e.g. tags).
 * For reads that filter by category exclusions, use `getAcceptedGrantExcludedIds` instead.
 */
async function assertAcceptedGrant(ctx: AuthedContext, grantorId: string): Promise<void> {
  const grant = await ctx.db.userAccessGrant.findFirst({
    where: {
      grantorId,
      granteeId: ctx.currentUser.id,
      status: GrantStatus.ACCEPTED,
    },
  });

  if (!grant) {
    throw new TRPCError({ code: "FORBIDDEN", message: "You do not have access to this user's data." });
  }
}

async function getAcceptedGrantExcludedIds(ctx: AuthedContext, grantorId: string): Promise<string[]> {
  const grant = await ctx.db.userAccessGrant.findFirst({
    where: {
      grantorId,
      granteeId: ctx.currentUser.id,
      status: GrantStatus.ACCEPTED,
    },
    include: {
      categoryExclusions: { select: { categoryId: true } },
    },
  });

  if (!grant) {
    throw new TRPCError({ code: "FORBIDDEN", message: "You do not have access to this user's data." });
  }

  return grant.categoryExclusions.map((e) => e.categoryId);
}

export const sharedAccessRouter = createTRPCRouter({
  // ─── Grant management ──────────────────────────────────────────────────────

  invite: authedProcedure.input(z.object({ email: z.string().email() })).mutation(async ({ ctx, input }) => {
    if (input.email === ctx.currentUser.email) {
      throw new TRPCError({ code: "FORBIDDEN", message: "You cannot invite yourself." });
    }

    const targetUser = await ctx.db.user.findUnique({ where: { email: input.email } });
    if (!targetUser) {
      throw new TRPCError({ code: "NOT_FOUND", message: "No user found with that email address." });
    }

    try {
      return await ctx.db.userAccessGrant.create({
        data: {
          grantorId: ctx.currentUser.id,
          granteeId: targetUser.id,
          status: GrantStatus.PENDING,
        },
      });
    } catch (err) {
      if (err instanceof PrismaClientKnownRequestError && err.code === "P2002") {
        throw new TRPCError({ code: "CONFLICT", message: "You have already invited this user." });
      }
      throw err;
    }
  }),

  respond: authedProcedure
    .input(z.object({ grantId: z.cuid(), action: z.enum(["accept", "decline"]) }))
    .mutation(async ({ ctx, input }) => {
      const grant = await ctx.db.userAccessGrant.findFirst({
        where: { id: input.grantId, granteeId: ctx.currentUser.id },
      });

      if (!grant) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      if (grant.status !== GrantStatus.PENDING) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "This invite has already been responded to." });
      }

      return await ctx.db.userAccessGrant.update({
        where: { id: input.grantId },
        data: { status: input.action === "accept" ? GrantStatus.ACCEPTED : GrantStatus.DECLINED },
      });
    }),

  revoke: authedProcedure.input(z.object({ grantId: z.cuid() })).mutation(async ({ ctx, input }) => {
    try {
      return await ctx.db.userAccessGrant.delete({
        where: { id: input.grantId, grantorId: ctx.currentUser.id },
      });
    } catch (err) {
      if (err instanceof PrismaClientKnownRequestError && err.code === "P2025") {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      throw err;
    }
  }),

  remove: authedProcedure.input(z.object({ grantId: z.cuid() })).mutation(async ({ ctx, input }) => {
    try {
      return await ctx.db.userAccessGrant.delete({
        where: { id: input.grantId, granteeId: ctx.currentUser.id },
      });
    } catch (err) {
      if (err instanceof PrismaClientKnownRequestError && err.code === "P2025") {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      throw err;
    }
  }),

  // ─── Queries ───────────────────────────────────────────────────────────────

  getGrantsGiven: authedProcedure.query(async ({ ctx }) => {
    return await ctx.db.userAccessGrant.findMany({
      where: {
        grantorId: ctx.currentUser.id,
        status: { in: [GrantStatus.PENDING, GrantStatus.ACCEPTED] },
      },
      include: {
        grantee: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "asc" },
    });
  }),

  getGrantsReceived: authedProcedure.query(async ({ ctx }) => {
    return await ctx.db.userAccessGrant.findMany({
      where: {
        granteeId: ctx.currentUser.id,
        status: { in: [GrantStatus.PENDING, GrantStatus.ACCEPTED] },
      },
      include: {
        grantor: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "asc" },
    });
  }),

  getPendingCount: authedProcedure.query(async ({ ctx }) => {
    return await ctx.db.userAccessGrant.count({
      where: {
        granteeId: ctx.currentUser.id,
        status: GrantStatus.PENDING,
      },
    });
  }),

  // ─── Exclusions ───────────────────────────────────────────────────────────

  getExclusionsForGrant: authedProcedure
    .input(z.object({ grantId: z.cuid() }))
    .query(async ({ ctx, input }) => {
      const grant = await ctx.db.userAccessGrant.findFirst({
        where: { id: input.grantId, grantorId: ctx.currentUser.id },
        include: {
          categoryExclusions: { select: { categoryId: true } },
        },
      });

      if (!grant) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return grant.categoryExclusions.map((e) => e.categoryId);
    }),

  toggleExclusion: authedProcedure
    .input(z.object({ grantId: z.cuid(), categoryId: z.cuid() }))
    .mutation(async ({ ctx, input }) => {
      const grant = await ctx.db.userAccessGrant.findFirst({
        where: { id: input.grantId, grantorId: ctx.currentUser.id },
      });

      if (!grant) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const category = await ctx.db.category.findFirst({
        where: { id: input.categoryId, userId: ctx.currentUser.id },
      });
      if (!category) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const existing = await ctx.db.accessGrantCategoryExclusion.findUnique({
        where: {
          grantId_categoryId: {
            grantId: input.grantId,
            categoryId: input.categoryId,
          },
        },
      });

      if (existing) {
        await ctx.db.accessGrantCategoryExclusion.delete({
          where: {
            grantId_categoryId: {
              grantId: input.grantId,
              categoryId: input.categoryId,
            },
          },
        });
        return { excluded: false };
      }

      await ctx.db.accessGrantCategoryExclusion.create({
        data: { grantId: input.grantId, categoryId: input.categoryId },
      });

      return { excluded: true };
    }),

  // ─── Shared data access ────────────────────────────────────────────────────

  getTasksForGrantor: authedProcedure
    .input(z.object({ grantorId: z.cuid() }))
    .query(async ({ ctx, input }) => {
      const excludedCategoryIds = await getAcceptedGrantExcludedIds(ctx, input.grantorId);

      const cutoff = subDays(new Date(), 14);

      const tasks = await ctx.db.task.findMany({
        where: {
          userId: input.grantorId,
          status: { not: TaskStatus.SKIPPED },
          NOT: {
            AND: [
              { status: { in: [...TERMINAL_TASK_STATUSES] } },
              { OR: [{ completedAt: { lt: cutoff } }, { completedAt: null }] },
            ],
          },
          // Include uncategorized tasks always; exclude tasks in hidden categories
          ...(excludedCategoryIds.length > 0
            ? {
                OR: [
                  { categoryId: null },
                  { categoryId: { notIn: excludedCategoryIds } },
                ],
              }
            : {}),
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

  getCategoriesForGrantor: authedProcedure
    .input(z.object({ grantorId: z.cuid() }))
    .query(async ({ ctx, input }) => {
      const excludedCategoryIds = await getAcceptedGrantExcludedIds(ctx, input.grantorId);

      return await ctx.db.category.findMany({
        where: {
          userId: input.grantorId,
          ...(excludedCategoryIds.length > 0 ? { id: { notIn: excludedCategoryIds } } : {}),
        },
        orderBy: { name: "asc" },
      });
    }),

  getTagsForGrantor: authedProcedure
    .input(z.object({ grantorId: z.cuid() }))
    .query(async ({ ctx, input }) => {
      await assertAcceptedGrant(ctx, input.grantorId);

      return await ctx.db.tag.findMany({
        where: { userId: input.grantorId },
      });
    }),

  getTaskByIdForGrantor: authedProcedure
    .input(z.object({ grantorId: z.cuid(), taskId: z.cuid() }))
    .query(async ({ ctx, input }) => {
      const excludedCategoryIds = await getAcceptedGrantExcludedIds(ctx, input.grantorId);

      const task = await ctx.db.task.findUnique({
        where: { id: input.taskId, userId: input.grantorId },
        include: {
          notes: { orderBy: { createdAt: "desc" } },
          category: true,
          tags: true,
        },
      });

      if (!task) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "This task doesn't exist or you don't have access to see it.",
        });
      }

      if (task.categoryId && excludedCategoryIds.includes(task.categoryId)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "This task doesn't exist or you don't have access to see it.",
        });
      }

      return task;
    }),
});
