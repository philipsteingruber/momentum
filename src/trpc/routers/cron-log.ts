import { adminProcedure, createTRPCRouter } from "@/trpc/init";
import { subDays, subHours } from "date-fns";
import { z } from "zod";

const dateRangeSchema = z.enum(["24h", "7d", "14d"]);
const levelFilterSchema = z.enum(["all", "info_above", "error_only"]);

const getDateCutoff = (dateRange: z.infer<typeof dateRangeSchema>): Date => {
  const now = new Date();
  if (dateRange === "24h") return subHours(now, 24);
  if (dateRange === "7d") return subDays(now, 7);
  return subDays(now, 14);
};

const getLevelFilter = (level: z.infer<typeof levelFilterSchema>): string[] | undefined => {
  if (level === "error_only") return ["error"];
  if (level === "info_above") return ["info", "error"];
  return undefined;
};

export const cronLogRouter = createTRPCRouter({
  getAll: adminProcedure
    .input(
      z.object({
        dateRange: dateRangeSchema,
        level: levelFilterSchema,
      }),
    )
    .query(async ({ ctx, input }) => {
      const levelFilter = getLevelFilter(input.level);
      return ctx.db.cronLog.findMany({
        where: {
          timestamp: { gte: getDateCutoff(input.dateRange) },
          ...(levelFilter ? { level: { in: levelFilter } } : {}),
        },
        orderBy: { timestamp: "desc" },
      });
    }),
});
