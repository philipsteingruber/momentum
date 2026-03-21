import { cronLog } from "@/lib/cron-logger";
import { verifyCronAuth } from "@/lib/cron-utils";
import { formatDigestEmbeds, sendDmToChannel } from "@/lib/discord";
import { sendDailyDigest } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { groupTasksForDigest } from "@/lib/task-utils";
import pLimit from "p-limit";

const JOB = "daily-digest";

const handler = async (req: Request): Promise<Response> => {
  const runId = crypto.randomUUID();
  await cronLog({ runId, job: JOB, event: "start", level: "info", data: { timestamp: new Date().toISOString() } });

  if (!verifyCronAuth(req)) {
    await cronLog({ runId, job: JOB, event: "auth.failed", level: "error" });
    return new Response("Unauthorized", { status: 401 });
  }

  const users = await prisma.user.findMany({
    include: {
      tasks: {
        where: {
          dueDate: { not: null },
        },
        orderBy: { dueDate: "asc" },
      },
      userSettings: { select: { discordDmChannelId: true } },
    },
  });

  const limit = pLimit(10);

  const results = await Promise.all(
    users.map((user) =>
      limit(async () => {
        if (!user.email) return null;

        const { overdue, dueToday, dueThisWeek } = groupTasksForDigest(user.tasks);
        const { success, error, id } = await sendDailyDigest({
          to: user.email,
          payload: { overdue, dueToday, dueThisWeek },
        });

        if (!success) {
          await cronLog({
            runId,
            job: JOB,
            event: "send.failed",
            level: "error",
            data: { userId: user.id, email: user.email, error: String(error) },
          });
          return null;
        }

        await cronLog({
          runId,
          job: JOB,
          event: "send.success",
          level: "info",
          data: { userId: user.id, email: user.email, emailId: id },
        });

        if (user.userSettings?.discordDmChannelId) {
          try {
            const embeds = formatDigestEmbeds({ overdue, dueToday, dueThisWeek });
            await sendDmToChannel(user.userSettings.discordDmChannelId, { embeds });
            await cronLog({
              runId,
              job: JOB,
              event: "discord.sent",
              level: "info",
              data: { userId: user.id },
            });
          } catch (discordError) {
            await cronLog({
              runId,
              job: JOB,
              event: "discord.failed",
              level: "error",
              data: { userId: user.id, error: String(discordError) },
            });
          }
        }

        return id!;
      }),
    ),
  );

  const sentEmails = results.filter((id): id is string => id !== null);

  await cronLog({
    runId,
    job: JOB,
    event: "complete",
    level: "info",
    data: { sent: sentEmails.length, totalUsers: users.length, timestamp: new Date().toISOString() },
  });

  return new Response(`Sent ${sentEmails.length} emails`, { status: 200 });
};

export { handler as GET };
