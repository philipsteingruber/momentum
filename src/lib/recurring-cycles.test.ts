import { TaskStatus } from "@/generated/prisma/enums";
import { describe, expect, it } from "vitest";
import { groupIntoCycles } from "./recurring-cycles";

const day1 = new Date("2026-11-16T23:00:00Z");
const day2 = new Date("2026-11-17T23:00:00Z");
const entry = (status: TaskStatus, cycleStart: Date | null) => ({ status, cycleStart });

describe("groupIntoCycles", () => {
  it("counts a cycle as a miss when fewer sessions than the target were completed", () => {
    const history = [entry(TaskStatus.SKIPPED, day1), entry(TaskStatus.COMPLETED, day1)];
    expect(groupIntoCycles(history, 2)).toEqual([{ status: TaskStatus.SKIPPED }]);
  });

  it("counts a cycle as complete when every session was completed", () => {
    const history = [entry(TaskStatus.COMPLETED, day1), entry(TaskStatus.COMPLETED, day1)];
    expect(groupIntoCycles(history, 2)).toEqual([{ status: TaskStatus.COMPLETED }]);
  });

  it("keeps a cycle completed under a lower target counted as complete", () => {
    expect(groupIntoCycles([entry(TaskStatus.COMPLETED, day1)], 2)).toEqual([{ status: TaskStatus.COMPLETED }]);
  });

  it("excludes a cycle whose sessions were all cancelled", () => {
    expect(groupIntoCycles([entry(TaskStatus.CANCELLED, day1)], 2)).toEqual([{ status: TaskStatus.CANCELLED }]);
  });

  it("leaves a partly done newest cycle pending so the streak is not broken yet", () => {
    const history = [
      entry(TaskStatus.PENDING, day2),
      entry(TaskStatus.COMPLETED, day2),
      entry(TaskStatus.SKIPPED, day1),
      entry(TaskStatus.COMPLETED, day1),
    ];
    expect(groupIntoCycles(history, 2)).toEqual([{ status: TaskStatus.PENDING }, { status: TaskStatus.SKIPPED }]);
  });

  it("returns each single-session task's own status unchanged", () => {
    const history = [entry(TaskStatus.IN_PROGRESS, day2), entry(TaskStatus.COMPLETED, day1)];
    expect(groupIntoCycles(history, 1)).toEqual([{ status: TaskStatus.IN_PROGRESS }, { status: TaskStatus.COMPLETED }]);
  });

  it("treats each task without a cycle start as its own cycle", () => {
    const history = [entry(TaskStatus.COMPLETED, null), entry(TaskStatus.COMPLETED, null)];
    expect(groupIntoCycles(history, 1)).toHaveLength(2);
  });
});
