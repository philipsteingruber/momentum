import { TaskStatus } from "@/generated/prisma/enums";
import { cronLog } from "@/lib/cron-logger";
import { verifyCronAuth } from "@/lib/cron-utils";
import { DEFAULT_TIMEZONE } from "@/lib/date-utils";
import { prisma } from "@/lib/prisma";
import { computeNextDueDate } from "@/lib/recurring-template-utils";
import { ACTIVE_TASK_STATUSES } from "@/lib/task-utils";

const JOB = "generate-tasks";

export const handler = async (req: Request): Promise<Response> => {
  const runId = crypto.randomUUID();
  await cronLog({ runId, job: JOB, event: "start", level: "info", data: { timestamp: new Date().toISOString() } });

  if (!verifyCronAuth(req)) {
    await cronLog({ runId, job: JOB, event: "auth.failed", level: "error" });
    return new Response("Unauthorized", { status: 401 });
  }

  const now = new Date();
  const users = await prisma.user.findMany({
    include: {
      recurringTemplates: {
        where: { nextDueDate: { lte: now } },
        include: {
          tasks: {
            where: { status: { in: [...ACTIVE_TASK_STATUSES] } },
            take: 1,
          },
        },
      },
      userSettings: { select: { timezone: true } },
    },
    where: { recurringTemplates: { some: { nextDueDate: { lte: now } } } },
  });

  const errors: Error[] = [];
  const successes: string[] = [];

  await Promise.all(
    users.map(async (user) => {
      await Promise.all(
        user.recurringTemplates.map(async (template) => {
          const activeTask = template.tasks[0];

          await prisma.$transaction(async (tx) => {
            try {
              if (activeTask) {
                await tx.task.update({ where: { id: activeTask.id }, data: { status: TaskStatus.SKIPPED } });
              }
              const newTask = await tx.task.create({
                data: {
                  title: template.title,
                  description: template.description,
                  status: TaskStatus.PENDING,
                  dueDate: template.nextDueDate,
                  externalContact: template.externalContact,
                  categoryId: template.categoryId,
                  recurringTemplateId: template.id,
                  link: template.link,
                  userId: user.id,
                },
              });
              await tx.recurringTemplate.update({
                where: { id: template.id },
                data: {
                  nextDueDate: computeNextDueDate({
                    recurrenceType: template.recurrenceType,
                    dayOfMonth: template.dayOfMonth ?? undefined,
                    dayOfWeek: template.dayOfWeek ?? undefined,
                    from: template.nextDueDate,
                    timezone: user.userSettings?.timezone ?? DEFAULT_TIMEZONE,
                  }),
                },
              });
              await cronLog({
                runId,
                job: JOB,
                event: "task.created",
                level: "info",
                data: { userId: user.id, email: user.email, taskId: newTask.id, timestamp: new Date().toISOString() },
              });
              successes.push(newTask.id);
            } catch (err) {
              await cronLog({
                runId,
                job: JOB,
                event: "task.failed",
                level: "error",
                data: { userId: user.id, email: user.email, error: String(err), timestamp: new Date().toISOString() },
              });
              errors.push(err as Error);
            }
          });
        }),
      );
    }),
  );

  await cronLog({
    runId,
    job: JOB,
    event: "complete",
    level: "info",
    data: { successes: successes.length, errors: errors.length, timestamp: new Date().toISOString() },
  });

  if (errors.length > 0) {
    return new Response("Some task creations/updates failed", { status: 207 });
  } else {
    return new Response("Tasks created/updated", { status: 200 });
  }
};

export { handler as GET };
