import { authedProcedure, createTRPCRouter } from "./../init";

export const discordRouter = createTRPCRouter({
  getStatus: authedProcedure.query(async ({ ctx }) => {
    const settings = await ctx.db.userSettings.findUnique({
      where: { userId: ctx.currentUser.id },
      select: { discordId: true },
    });

    return {
      connected: settings?.discordId !== null && settings?.discordId !== undefined,
      discordId: settings?.discordId ?? null,
    };
  }),

  unlink: authedProcedure.mutation(async ({ ctx }) => {
    await ctx.db.userSettings.update({
      where: { userId: ctx.currentUser.id },
      data: { discordId: null, discordDmChannelId: null },
    });
  }),
});
