import type { Task } from "@/generated/prisma/client";
import { TaskStatus } from "@/generated/prisma/enums";
import { ACTIVE_TASK_STATUSES, TERMINAL_TASK_STATUSES } from "@/lib/task-utils";

// Client-safe: no Prisma runtime imports. Server-side execution lives in apply-task-status-change.ts.

export const MAX_TIMES_PER_CYCLE = 10;

export type SessionTask = Pick<Task, "status" | "recurringTemplateId" | "cycleStart" | "sessionIndex">;

export type StatusChangeAction =
  | { kind: "spawnNextSession"; cycleStart: Date; sessionIndex: number }
  | { kind: "deleteOpenNextSession"; cycleStart: Date; sessionIndex: number };

/**
 * Decides what a status change means for the rest of the cycle.
 * Completing session k (k < target) spawns session k+1. Leaving COMPLETED
 * removes the not-yet-finished session k+1, so a cycle never has two open sessions.
 */
export function planStatusChange(
  task: SessionTask,
  timesPerCycle: number,
  newStatus: TaskStatus,
): StatusChangeAction[] {
  if (!task.recurringTemplateId || !task.cycleStart || task.sessionIndex === null) return [];
  if (task.status === newStatus) return [];

  const next = { cycleStart: task.cycleStart, sessionIndex: task.sessionIndex + 1 };

  if (newStatus === TaskStatus.COMPLETED && task.sessionIndex < timesPerCycle) {
    return [{ kind: "spawnNextSession", ...next }];
  }
  if (task.status === TaskStatus.COMPLETED) {
    return [{ kind: "deleteOpenNextSession", ...next }];
  }
  return [];
}

export function firstSessionFields(dueDate: Date): { cycleStart: Date; sessionIndex: number } {
  return { cycleStart: dueDate, sessionIndex: 1 };
}

export type SessionProgress = { done: number; target: number; isComplete: boolean };

/**
 * Sessions are created strictly in order, so a task's own sessionIndex tells us
 * how many sessions of its cycle are done: all of them up to itself if it is
 * completed, all before it otherwise.
 */
export function getSessionProgress(
  task: Pick<Task, "status" | "sessionIndex">,
  timesPerCycle: number,
): SessionProgress | null {
  if (timesPerCycle <= 1 || task.sessionIndex === null) return null;
  const done = task.status === TaskStatus.COMPLETED ? task.sessionIndex : task.sessionIndex - 1;
  return { done, target: timesPerCycle, isComplete: done >= timesPerCycle };
}

export function formatSessionProgress(progress: SessionProgress): string {
  return `${progress.done}/${progress.target}`;
}

export function appendSessionProgress(
  title: string,
  task: Pick<Task, "status" | "sessionIndex">,
  timesPerCycle: number,
): string {
  const progress = getSessionProgress(task, timesPerCycle);
  return progress ? `${title} (${formatSessionProgress(progress)})` : title;
}

export const OPTIMISTIC_ID_PREFIX = "optimistic:";

export function isOptimisticPlaceholderId(id: string): boolean {
  return id.startsWith(OPTIMISTIC_ID_PREFIX);
}

export type OptimisticTask = Pick<
  Task,
  "id" | "status" | "completedAt" | "createdAt" | "recurringTemplateId" | "cycleStart" | "sessionIndex"
> & { recurringTemplate?: { timesPerCycle: number } | null };

/**
 * Client mirror of applyTaskStatusChange for the task.getAll cache. The placeholder
 * is replaced by the real row when onSettled refetches.
 */
export function applyOptimisticStatusChange<T extends OptimisticTask>(
  tasks: T[],
  taskId: string,
  newStatus: TaskStatus,
  now: Date,
): T[] {
  const target = tasks.find((t) => t.id === taskId);
  if (!target) return tasks;

  const completedAt = (TERMINAL_TASK_STATUSES as readonly TaskStatus[]).includes(newStatus) ? now : null;
  const updated = tasks.map((t) => (t.id === taskId ? { ...t, status: newStatus, completedAt } : t));

  const timesPerCycle = target.recurringTemplate?.timesPerCycle ?? 1;
  const [action] = planStatusChange(target, timesPerCycle, newStatus);
  if (!action) return updated;

  if (action.kind === "spawnNextSession") {
    const placeholder = {
      ...target,
      id: `${OPTIMISTIC_ID_PREFIX}${target.id}:next`,
      status: TaskStatus.PENDING,
      completedAt: null,
      createdAt: now,
      sessionIndex: action.sessionIndex,
    } as T;
    return [...updated, placeholder];
  }

  return updated.filter(
    (t) =>
      !(
        t.recurringTemplateId === target.recurringTemplateId &&
        t.cycleStart?.getTime() === action.cycleStart.getTime() &&
        t.sessionIndex === action.sessionIndex &&
        (ACTIVE_TASK_STATUSES as readonly TaskStatus[]).includes(t.status)
      ),
  );
}
