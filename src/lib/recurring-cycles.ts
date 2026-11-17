import { TaskStatus } from "@/generated/prisma/enums";
import { ACTIVE_TASK_STATUSES } from "@/lib/task-utils";

export type CycleTaskEntry = { status: TaskStatus; cycleStart?: Date | null };

/**
 * Collapses sessions (newest first) into one entry per cycle, so streak and
 * percentage math keeps treating "one entry = one cycle".
 */
export function groupIntoCycles(tasksNewestFirst: CycleTaskEntry[], timesPerCycle: number): { status: TaskStatus }[] {
  const cycles: CycleTaskEntry[][] = [];
  const indexByKey = new Map<number, number>();

  for (const task of tasksNewestFirst) {
    const key = task.cycleStart?.getTime();
    if (key === undefined) {
      cycles.push([task]);
      continue;
    }
    const existing = indexByKey.get(key);
    if (existing === undefined) {
      indexByKey.set(key, cycles.length);
      cycles.push([task]);
    } else {
      cycles[existing].push(task);
    }
  }

  return cycles.map((sessions) => ({ status: cycleOutcome(sessions, timesPerCycle) }));
}

function cycleOutcome(sessionsNewestFirst: CycleTaskEntry[], timesPerCycle: number): TaskStatus {
  const completed = sessionsNewestFirst.filter((s) => s.status === TaskStatus.COMPLETED).length;
  if (completed >= timesPerCycle) return TaskStatus.COMPLETED;
  // A cycle finished under a lower target (template later raised) stays completed.
  if (completed > 0 && completed === sessionsNewestFirst.length) return TaskStatus.COMPLETED;
  if (sessionsNewestFirst.every((s) => s.status === TaskStatus.CANCELLED)) return TaskStatus.CANCELLED;

  const latest = sessionsNewestFirst[0].status;
  return (ACTIVE_TASK_STATUSES as readonly TaskStatus[]).includes(latest) ? latest : TaskStatus.SKIPPED;
}
