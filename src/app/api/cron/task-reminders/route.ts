import { cronLog } from "@/lib/cron-logger";
import { verifyCronAuth } from "@/lib/cron-utils";
import { DEFAULT_TIMEZONE, formatInUserTz } from "@/lib/date-utils";
import { formatReminderEmbed, sendDmToChannel } from "@/lib/discord";
import { prisma } from "@/lib/prisma";
import { ACTIVE_TASK_STATUSES } from "@/lib/task-utils";
import { startOfDay } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import pLimit from "p-limit";

const JOB = "task-reminders";

const handler = async (req: Request): Promise<Response> => {
  const runId = crypto.randomUUID();
  await cronLog({ runId, job: JOB, event: "start", level: "info", data: { timestamp: new Date().toISOString() } });

  if (!(await verifyCronAuth(req))) {
    await cronLog({ runId, job: JOB, event: "auth.failed", level: "error" });
    return new Response("Unauthorized", { status: 401 });
  }

  const now = new Date();

  const users = await prisma.user.findMany({
    where: { userSettings: { discordDmChannelId: { not: null } } },
    include: {
      tasks: {
        where: {
          dueDate: { not: null },
          reminderTime: { not: null },
          reminderSentAt: null,
          status: { in: [...ACTIVE_TASK_STATUSES] },
        },
      },
      userSettings: { select: { discordDmChannelId: true, timezone: true } },
    },
  });

  const limit = pLimit(10);
  let sent = 0;

  await Promise.all(
    users.map((user) =>
      limit(async () => {
        const channelId = user.userSettings!.discordDmChannelId!;
        const timezone = user.userSettings?.timezone ?? DEFAULT_TIMEZONE;
        const todayStart = startOfDay(toZonedTime(now, timezone)).getTime();
        const currentLocalTime = formatInUserTz(now, "HH:mm", timezone);

        const dueTasks = user.tasks.filter(
          (task) =>
            startOfDay(toZonedTime(task.dueDate!, timezone)).getTime() === todayStart &&
            task.reminderTime! <= currentLocalTime,
        );

        if (dueTasks.length === 0) return;

        try {
          await sendDmToChannel(channelId, { embeds: [formatReminderEmbed(dueTasks)] });
          await prisma.task.updateMany({
            where: { id: { in: dueTasks.map((task) => task.id) } },
            data: { reminderSentAt: now },
          });
          sent += dueTasks.length;
          await cronLog({
            runId,
            job: JOB,
            event: "reminder.sent",
            level: "info",
            data: { userId: user.id, taskIds: dueTasks.map((task) => task.id) },
          });
        } catch (error) {
          await cronLog({
            runId,
            job: JOB,
            event: "reminder.failed",
            level: "error",
            data: { userId: user.id, taskIds: dueTasks.map((task) => task.id), error: String(error) },
          });
        }
      }),
    ),
  );

  await cronLog({
    runId,
    job: JOB,
    event: "complete",
    level: "info",
    data: { sent, totalUsers: users.length, timestamp: now.toISOString() },
  });

  return new Response(`Sent ${sent} reminders`, { status: 200 });
};

export { handler as GET };
