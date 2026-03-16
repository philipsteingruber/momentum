import type { Task } from "@/generated/prisma/client";
import type { TaskStatus } from "@/generated/prisma/enums";
import { endOfWeek, isAfter, isBefore, startOfDay } from "date-fns";

export const parseTaskStatus = (taskStatus: TaskStatus) => {
  const words = taskStatus.split("_");
  return words.map((word) => capitaliseFirstCharacter(word)).join(" ");
};

export const capitaliseFirstCharacter = (str: string) => {
  return str.length > 0 ? str[0].toUpperCase() + str.slice(1).toLowerCase() : "";
};

export const isOverdue = (dueDate: Date | null): boolean => {
  return dueDate ? isAfter(new Date(), dueDate) : false;
};

export const groupTasksByStatus = (tasks: Task[]) => {
  const tasksByGroup = tasks.reduce(
    (groups, task) => {
      groups[task.status].push(task);
      return groups;
    },
    { PENDING: [], IN_PROGRESS: [], BLOCKED: [], COMPLETED: [], CANCELLED: [], OVERDUE: [] } as Record<
      TaskStatus | "OVERDUE",
      Task[]
    >,
  );

  tasksByGroup.OVERDUE = tasks.filter(
    (task) =>
      task.dueDate &&
      isBefore(startOfDay(task.dueDate), startOfDay(new Date())) &&
      task.status !== "CANCELLED" &&
      task.status !== "COMPLETED",
  );

  return tasksByGroup;
};

export type DigestTaskGroups = {
  overdue: Task[];
  dueToday: Task[];
  dueThisWeek: { date: Date; tasks: Task[] }[];
};

export const groupTasksForDigest = (tasks: Task[]): DigestTaskGroups => {
  const today = startOfDay(new Date());
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
  const todayKey = today.getTime();
  const weekEndKey = weekEnd.getTime();

  const overdue: Task[] = [];
  const dueToday: Task[] = [];
  const byDate = new Map<number, { date: Date; tasks: Task[] }>();

  for (const task of tasks) {
    if (task.status === "CANCELLED" || task.status === "COMPLETED" || !task.dueDate) {
      continue;
    }

    const dayStart = startOfDay(task.dueDate);
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
