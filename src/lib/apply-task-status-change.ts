import type { Prisma, Task } from "@/generated/prisma/client";
import { TaskStatus } from "@/generated/prisma/enums";
import { planStatusChange } from "@/lib/recurring-sessions";
import { ACTIVE_TASK_STATUSES, TERMINAL_TASK_STATUSES } from "@/lib/task-utils";

export class TaskNotFoundError extends Error {
  constructor(taskId: string) {
    super(`Task ${taskId} not found`);
    this.name = "TaskNotFoundError";
  }
}

export type TaskStatusChangeResult = { task: Task; timesPerCycle: number };

/**
 * The single place a task's status changes, for every caller except the HA endpoint
 * (see the spec's Future work). Must run inside a transaction so the status update
 * and the session spawn/delete commit together.
 */
export async function applyTaskStatusChange(
  tx: Prisma.TransactionClient,
  { taskId, userId, newStatus }: { taskId: string; userId: string; newStatus: TaskStatus },
): Promise<TaskStatusChangeResult> {
  const existing = await tx.task.findFirst({
    where: { id: taskId, userId },
    include: { recurringTemplate: true },
  });
  if (!existing) throw new TaskNotFoundError(taskId);

  const isTerminal = (TERMINAL_TASK_STATUSES as readonly TaskStatus[]).includes(newStatus);
  const task = await tx.task.update({
    where: { id: taskId },
    data: { status: newStatus, completedAt: isTerminal ? new Date() : null },
  });

  const template = existing.recurringTemplate;
  const timesPerCycle = template?.timesPerCycle ?? 1;
  if (!template) return { task, timesPerCycle };

  for (const action of planStatusChange(existing, timesPerCycle, newStatus)) {
    if (action.kind === "spawnNextSession") {
      // A newer cycle already exists, so this cycle has ended and must not grow a new open session.
      const newerCycleTasks = await tx.task.count({
        where: { recurringTemplateId: template.id, cycleStart: { gt: action.cycleStart } },
      });
      if (newerCycleTasks > 0) continue;
      // skipDuplicates = ON CONFLICT DO NOTHING. A concurrent completion that already spawned this
      // session is a no-op instead of a P2002, which would abort the whole Postgres transaction.
      await tx.task.createMany({
        data: [
          {
            title: template.title,
            description: template.description,
            externalContact: template.externalContact,
            link: template.link,
            reminderTime: template.reminderTime,
            // Today's reminder already went out for this cycle; don't send it again for the next session.
            reminderSentAt: existing.reminderSentAt,
            categoryId: template.categoryId,
            status: TaskStatus.PENDING,
            dueDate: existing.dueDate,
            userId,
            recurringTemplateId: template.id,
            cycleStart: action.cycleStart,
            sessionIndex: action.sessionIndex,
          },
        ],
        skipDuplicates: true,
      });
    } else {
      await tx.task.deleteMany({
        where: {
          recurringTemplateId: template.id,
          cycleStart: action.cycleStart,
          sessionIndex: action.sessionIndex,
          status: { in: [...ACTIVE_TASK_STATUSES] },
        },
      });
    }
  }

  return { task, timesPerCycle };
}
