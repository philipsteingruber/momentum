import type { Task } from "@/generated/prisma/client";
import { TaskStatus } from "@/generated/prisma/enums";
import { endOfWeek, isAfter, isBefore, startOfDay } from "date-fns";
import { toZonedTime } from "date-fns-tz";

export const ACTIVE_TASK_STATUSES = [TaskStatus.PENDING, TaskStatus.IN_PROGRESS, TaskStatus.BLOCKED] as const;

export const TERMINAL_TASK_STATUSES = [TaskStatus.COMPLETED, TaskStatus.CANCELLED] as const;

export const SNOOZE_OPTIONS = [1, 3, 7] as const;

export const parseTaskStatus = (taskStatus: TaskStatus) => {
  const words = taskStatus.split("_");
  return words.map((word) => capitaliseFirstCharacter(word)).join(" ");
};

export const capitaliseFirstCharacter = (str: string) => {
  return str.length > 0 ? str[0].toUpperCase() + str.slice(1).toLowerCase() : "";
};

/** @deprecated Use isOverdueInUserTz from date-utils for timezone-aware comparisons */
export const isOverdue = (dueDate: Date | null): boolean => {
  return dueDate ? isAfter(new Date(), dueDate) : false;
};

export const OVERDUE_STATUS = "OVERDUE" as const;

export const groupTasksByStatus = (tasks: Task[], timezone: string) => {
  const tasksByGroup = tasks.reduce(
    (groups, task) => {
      groups[task.status].push(task);
      return groups;
    },
    { PENDING: [], IN_PROGRESS: [], BLOCKED: [], COMPLETED: [], CANCELLED: [], OVERDUE: [], SKIPPED: [] } as Record<
      TaskStatus | typeof OVERDUE_STATUS,
      Task[]
    >,
  );

  const activeRecurringTemplateIds = new Set(
    tasks
      .filter((t) => t.recurringTemplateId && (ACTIVE_TASK_STATUSES as readonly TaskStatus[]).includes(t.status))
      .map((t) => t.recurringTemplateId),
  );

  for (const status of TERMINAL_TASK_STATUSES) {
    tasksByGroup[status] = tasksByGroup[status].filter(
      (t) => !t.recurringTemplateId || !activeRecurringTemplateIds.has(t.recurringTemplateId),
    );
  }

  const todayStart = startOfDay(toZonedTime(new Date(), timezone));
  tasksByGroup[OVERDUE_STATUS] = tasks.filter(
    (task) =>
      task.dueDate &&
      isBefore(startOfDay(toZonedTime(task.dueDate, timezone)), todayStart) &&
      task.status !== "CANCELLED" &&
      task.status !== "COMPLETED",
  );

  return tasksByGroup;
};

export const sortTasksForKanban = (tasks: Task[], status: TaskStatus | typeof OVERDUE_STATUS): Task[] => {
  if (status === TaskStatus.COMPLETED || status === TaskStatus.CANCELLED) {
    return [...tasks].sort((a, b) => {
      const aTime = a.completedAt?.getTime() ?? 0;
      const bTime = b.completedAt?.getTime() ?? 0;
      return bTime - aTime;
    });
  }

  return [...tasks].sort((a, b) => {
    if (!a.dueDate && !b.dueDate) return a.createdAt.getTime() - b.createdAt.getTime();
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    const dateDiff = a.dueDate.getTime() - b.dueDate.getTime();
    return dateDiff !== 0 ? dateDiff : a.createdAt.getTime() - b.createdAt.getTime();
  });
};

export type DigestTaskGroups = {
  overdue: Task[];
  dueToday: Task[];
  dueThisWeek: { date: Date; tasks: Task[] }[];
};

export const groupTasksForDigest = (tasks: Task[], timezone: string): DigestTaskGroups => {
  const today = startOfDay(toZonedTime(new Date(), timezone));
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
  const todayKey = today.getTime();
  const weekEndKey = weekEnd.getTime();

  const overdue: Task[] = [];
  const dueToday: Task[] = [];
  const byDate = new Map<number, { date: Date; tasks: Task[] }>();

  for (const task of tasks) {
    if (task.status === "CANCELLED" || task.status === "COMPLETED" || task.status === "SKIPPED" || !task.dueDate) {
      continue;
    }

    const dayStart = startOfDay(toZonedTime(task.dueDate, timezone));
    const dayKey = dayStart.getTime();

    if (dayKey < todayKey) {
      overdue.push(task);
    } else if (dayKey === todayKey) {
      dueToday.push(task);
    } else if (dayKey <= weekEndKey) {
      if (!byDate.has(dayKey)) {
        byDate.set(dayKey, { date: dayStart, tasks: [] });
      }
      byDate.get(dayKey)!.tasks.push(task);
    }
  }

  const dueThisWeek = Array.from(byDate.values()).sort((a, b) => a.date.getTime() - b.date.getTime());

  return { overdue, dueToday, dueThisWeek };
};
