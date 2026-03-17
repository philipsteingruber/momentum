import { TaskStatus } from "@/generated/prisma/enums";
import { verifyCronAuth } from "@/lib/cron-utils";
import { prisma } from "@/lib/prisma";
import { computeNextDueDate } from "@/lib/recurring-template-utils";

export const handler = async (req: Request): Promise<Response> => {
  if (!verifyCronAuth(req)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const now = new Date();
  const users = await prisma.user.findMany({
    include: {
      recurringTemplates: {
        where: { nextDueDate: { lte: now } },
        include: {
          tasks: {
            where: { status: { in: [TaskStatus.BLOCKED, TaskStatus.IN_PROGRESS, TaskStatus.PENDING] } },
            take: 1,
          },
        },
      },
      userSettings: { select: { timezone: true } },
    },
    where: { recurringTemplates: { some: { nextDueDate: { lte: now } } } },
  });

  const errors: Error[] = [];

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
              await tx.task.create({
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
                    timezone: user.userSettings?.timezone ?? "Europe/Stockholm",
                  }),
                },
              });
            } catch (err) {
              console.error(err);
              errors.push(err as Error);
            }
          });
        }),
      );
    }),
  );

  if (errors.length > 0) {
    return new Response("Some task creations/updates failed", { status: 207 });
  } else {
    return new Response("Tasks created/updated", { status: 200 });
  }
};

export { handler as GET };
