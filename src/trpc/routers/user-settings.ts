import z from "zod";
import { authedProcedure, createTRPCRouter } from "../init";

export const userSettingsRouter = createTRPCRouter({
  get: authedProcedure.query(async ({ ctx }) => {
    return await ctx.db.userSettings.upsert({
      where: { userId: ctx.currentUser.id },
      update: {},
      create: { userId: ctx.currentUser.id },
    });
  }),

  update: authedProcedure
    .input(z.object({ timezone: z.string().refine((val) => Intl.supportedValuesOf("timeZone").includes(val)) }))
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.userSettings.upsert({
        where: { userId: ctx.currentUser.id },
        update: { timezone: input.timezone },
        create: { userId: ctx.currentUser.id, timezone: input.timezone },
      });
    }),
});
