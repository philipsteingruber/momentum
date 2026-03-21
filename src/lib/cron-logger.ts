import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

type LogLevel = "info" | "error" | "debug";

interface CronLogEntry {
  runId: string;
  job: string;
  event: string;
  level: LogLevel;
  data?: Prisma.InputJsonObject;
}

export const cronLog = async ({ runId, job, event, level, data }: CronLogEntry): Promise<void> => {
  console.log(JSON.stringify({ event, level, runId, job, ...data }));
  await prisma.cronLog.create({
    data: { runId, job, event, level, data: data ?? {} },
  });
};
