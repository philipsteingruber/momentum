import { sendDailyDigest } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { groupTasksForDigest } from "@/lib/task-utils";
import pLimit from "p-limit";

const handler = async (req: Request): Promise<Response> => {
  const authHeader = req.headers.get("Authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
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
          console.error(error);
          return null;
        }

        return id!;
      }),
    ),
  );

  const sentEmails = results.filter((id): id is string => id !== null);

  return new Response(`Sent ${sentEmails.length} emails`, { status: 200 });
};

export { handler as GET };
