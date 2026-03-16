import { TaskStatus } from "@/generated/prisma/enums";
import { verifyCronAuth } from "@/lib/cron-utils";
import { prisma } from "@/lib/prisma";
import { computeNextDueDate } from "@/lib/recurring-template-utils";

export const handler = async (req: Request): Promise<Response> => {
  if (!verifyCronAuth(req)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const users = await prisma.user.findMany({
    include: {
      recurringTemplates: {
        where: { nextDueDate: { lte: new Date() } },
        include: {
          tasks: {
            where: { status: { in: [TaskStatus.BLOCKED, TaskStatus.IN_PROGRESS, TaskStatus.PENDING] } },
            take: 1,
          },
        },
      },
    },
    where: { recurringTemplates: { some: { nextDueDate: { lte: new Date() } } } },
  });

  const errors: Error[] = [];

  await Promise.all(
    users.map(async (user) => {
      await Promise.all(
        user.recurringTemplates.map(async (template) => {
          const activeTask = template.tasks[0];

          if (activeTask) {
            try {
              await prisma.$transaction(async (tx) => {
                await tx.task.update({ where: { id: activeTask.id }, data: { status: TaskStatus.SKIPPED } });
                await tx.task.create({
                  data: {
                    title: activeTask.title,
                    description: activeTask.description,
                    status: TaskStatus.PENDING,
                    dueDate: template.nextDueDate,
                    externalContact: activeTask.externalContact,
                    categoryId: activeTask.categoryId,
                    recurringTemplateId: template.id,
                    link: activeTask.link,
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
                    }),
                  },
                });
              });
            } catch (err) {
              console.error(err);
              errors.push(err as Error);
              return;
            }
          }
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
