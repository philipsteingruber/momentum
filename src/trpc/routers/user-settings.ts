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
    .input(
      z.object({
        timezone: z.string().refine((val) => Intl.supportedValuesOf("timeZone").includes(val)),
        locale: z.literal("en").or(z.literal("sv")),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.userSettings.upsert({
        where: { userId: ctx.currentUser.id },
        update: { timezone: input.timezone, locale: input.locale },
        create: { userId: ctx.currentUser.id, timezone: input.timezone, locale: input.locale },
      });
    }),
});
