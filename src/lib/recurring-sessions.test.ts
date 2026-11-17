import { TaskStatus } from "@/generated/prisma/enums";
import { describe, expect, it } from "vitest";
import {
  appendSessionProgress,
  applyOptimisticStatusChange,
  firstSessionFields,
  formatSessionProgress,
  getSessionProgress,
  isOptimisticPlaceholderId,
  planStatusChange,
} from "./recurring-sessions";

const cycleStart = new Date("2026-11-17T23:00:00Z");
const session = (sessionIndex: number, status: TaskStatus = TaskStatus.PENDING) => ({
  status,
  recurringTemplateId: "c_template",
  cycleStart,
  sessionIndex,
});

describe("planStatusChange", () => {
  it("spawns the next session when a session below the target is completed", () => {
    expect(planStatusChange(session(1), 2, TaskStatus.COMPLETED)).toEqual([
      { kind: "spawnNextSession", cycleStart, sessionIndex: 2 },
    ]);
  });

  it("spawns nothing when the final session is completed", () => {
    expect(planStatusChange(session(2), 2, TaskStatus.COMPLETED)).toEqual([]);
  });

  it("spawns nothing for a single-session template", () => {
    expect(planStatusChange(session(1), 1, TaskStatus.COMPLETED)).toEqual([]);
  });

  it("spawns nothing when a session is skipped", () => {
    expect(planStatusChange(session(1), 2, TaskStatus.SKIPPED)).toEqual([]);
  });

  it("deletes the open next session when a completed session is reopened", () => {
    expect(planStatusChange(session(1, TaskStatus.COMPLETED), 2, TaskStatus.PENDING)).toEqual([
      { kind: "deleteOpenNextSession", cycleStart, sessionIndex: 2 },
    ]);
  });

  it("deletes the open next session when a completed session is cancelled", () => {
    expect(planStatusChange(session(1, TaskStatus.COMPLETED), 2, TaskStatus.CANCELLED)).toEqual([
      { kind: "deleteOpenNextSession", cycleStart, sessionIndex: 2 },
    ]);
  });

  it("plans nothing for a task without cycle fields", () => {
    const task = { status: TaskStatus.PENDING, recurringTemplateId: null, cycleStart: null, sessionIndex: null };
    expect(planStatusChange(task, 2, TaskStatus.COMPLETED)).toEqual([]);
  });

  it("plans nothing when the status does not change", () => {
    expect(planStatusChange(session(1, TaskStatus.COMPLETED), 2, TaskStatus.COMPLETED)).toEqual([]);
  });
});

describe("firstSessionFields", () => {
  it("starts a cycle at session one anchored to the due date", () => {
    expect(firstSessionFields(cycleStart)).toEqual({ cycleStart, sessionIndex: 1 });
  });
});

describe("getSessionProgress", () => {
  it("returns no progress for a single-session template", () => {
    expect(getSessionProgress(session(1), 1)).toBeNull();
  });

  it("counts a completed session as done for the completed card", () => {
    expect(getSessionProgress(session(1, TaskStatus.COMPLETED), 2)).toEqual({ done: 1, target: 2, isComplete: false });
  });

  it("counts only earlier sessions as done for an open card", () => {
    expect(getSessionProgress(session(2), 2)).toEqual({ done: 1, target: 2, isComplete: false });
  });

  it("marks the cycle complete when the final session is completed", () => {
    expect(getSessionProgress(session(2, TaskStatus.COMPLETED), 2)?.isComplete).toBe(true);
  });
});

describe("formatSessionProgress", () => {
  it("formats progress as done over target", () => {
    expect(formatSessionProgress({ done: 1, target: 3, isComplete: false })).toBe("1/3");
  });
});

describe("appendSessionProgress", () => {
  it("appends progress in parentheses for a multi-session task", () => {
    expect(appendSessionProgress("Brush teeth", session(2), 2)).toBe("Brush teeth (1/2)");
  });

  it("leaves the title unchanged for a single-session task", () => {
    expect(appendSessionProgress("Brush teeth", session(1), 1)).toBe("Brush teeth");
  });
});

describe("applyOptimisticStatusChange", () => {
  const now = new Date("2026-11-18T07:00:00Z");
  const cached = (sessionIndex: number, status: TaskStatus, id = `c_session_${sessionIndex}`) => ({
    id,
    status,
    completedAt: null,
    createdAt: new Date("2026-11-18T06:00:00Z"),
    recurringTemplateId: "c_template",
    cycleStart,
    sessionIndex,
    recurringTemplate: { timesPerCycle: 2 },
  });

  it("inserts a placeholder next session when a session below the target is completed", () => {
    const result = applyOptimisticStatusChange(
      [cached(1, TaskStatus.PENDING)],
      "c_session_1",
      TaskStatus.COMPLETED,
      now,
    );

    expect(result).toHaveLength(2);
    expect(result[1]).toMatchObject({ status: TaskStatus.PENDING, sessionIndex: 2, completedAt: null, createdAt: now });
    expect(isOptimisticPlaceholderId(result[1].id)).toBe(true);
  });

  it("stamps completedAt on the completed session", () => {
    const [completed] = applyOptimisticStatusChange(
      [cached(1, TaskStatus.PENDING)],
      "c_session_1",
      TaskStatus.COMPLETED,
      now,
    );

    expect(completed).toMatchObject({ status: TaskStatus.COMPLETED, completedAt: now });
  });

  it("removes the open next session when a completed session is reopened", () => {
    const result = applyOptimisticStatusChange(
      [cached(1, TaskStatus.COMPLETED), cached(2, TaskStatus.PENDING)],
      "c_session_1",
      TaskStatus.PENDING,
      now,
    );

    expect(result.map((t) => t.id)).toEqual(["c_session_1"]);
  });

  it("changes only the status of a task outside any cycle", () => {
    const plain = { ...cached(1, TaskStatus.PENDING), recurringTemplateId: null, cycleStart: null, sessionIndex: null };

    const result = applyOptimisticStatusChange([plain], plain.id, TaskStatus.COMPLETED, now);

    expect(result).toEqual([{ ...plain, status: TaskStatus.COMPLETED, completedAt: now }]);
  });
});
