import { cache } from "react";

import { auth } from "@clerk/nextjs/server";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export const createTRPCContext = cache(async () => {
  const authResult = await auth();
  const currentUser = authResult.userId
    ? await prisma.user.findUnique({
        where: { clerkId: authResult.userId },
        include: { userSettings: true },
      })
    : null;
  return { db: prisma, auth: authResult, currentUser };
});

type Context = Awaited<ReturnType<typeof createTRPCContext>>;

const t = initTRPC.context<Context>().create({
  /**
   * @see https://trpc.io/docs/server/data-transformers
   */
  transformer: superjson,
});

const isAuthed = t.middleware(async ({ next, ctx }) => {
  if (!ctx.auth.userId || !ctx.currentUser) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  if (!ctx.currentUser.userSettings) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
  }

  return next({
    ctx: {
      ...ctx,
      currentUser: ctx.currentUser as AuthedUser,
    },
  });
});

type AuthedUser = Omit<UserWithSettings, "userSettings"> & {
  userSettings: NonNullable<UserWithSettings["userSettings"]>;
};
type UserWithSettings = Prisma.UserGetPayload<{ include: { userSettings: true } }>;
export type AuthedContext = Context & {
  currentUser: AuthedUser;
};

// Base router and procedure helpers
export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;
export const publicProcedure = t.procedure;
export const authedProcedure = publicProcedure.use(isAuthed);
