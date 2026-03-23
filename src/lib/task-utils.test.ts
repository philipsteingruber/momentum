import { TaskStatus } from "@/generated/prisma/enums";
import { createMockTask } from "@/test-utils/factories";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  OVERDUE_STATUS,
  capitaliseFirstCharacter,
  groupTasksForDigest,
  groupTasksByStatus,
  isOverdue,
  parseTaskStatus,
} from "./task-utils";

const TZ = "Europe/Stockholm";

// ─── capitaliseFirstCharacter ────────────────────────────────────────────────

describe("capitaliseFirstCharacter", () => {
  it("capitalises the first character and lowercases the rest", () => {
    expect(capitaliseFirstCharacter("HELLO")).toBe("Hello");
  });
  it("handles a single character", () => {
    expect(capitaliseFirstCharacter("a")).toBe("A");
  });
  it("returns empty string for empty input", () => {
    expect(capitaliseFirstCharacter("")).toBe("");
  });
});

// ─── parseTaskStatus ─────────────────────────────────────────────────────────

describe("parseTaskStatus", () => {
  it("formats single-word statuses", () => {
    expect(parseTaskStatus(TaskStatus.PENDING)).toBe("Pending");
    expect(parseTaskStatus(TaskStatus.COMPLETED)).toBe("Completed");
    expect(parseTaskStatus(TaskStatus.BLOCKED)).toBe("Blocked");
    expect(parseTaskStatus(TaskStatus.CANCELLED)).toBe("Cancelled");
  });
  it("formats multi-word statuses", () => {
    expect(parseTaskStatus(TaskStatus.IN_PROGRESS)).toBe("In Progress");
  });
});

// ─── isOverdue ───────────────────────────────────────────────────────────────

describe("isOverdue", () => {
  it("returns false for null dueDate", () => {
    expect(isOverdue(null)).toBe(false);
  });
  it("returns true for a date in the past", () => {
    expect(isOverdue(new Date("2000-01-01"))).toBe(true);
  });
  it("returns false for a date in the future", () => {
    expect(isOverdue(new Date("2099-12-31"))).toBe(false);
  });
});

// ─── groupTasksByStatus ──────────────────────────────────────────────────────
// System time: Saturday 2024-06-15 10:00 UTC = 12:00 Stockholm (UTC+2)

describe("groupTasksByStatus", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-15T10:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("places tasks into their correct status bucket", () => {
    const pending = createMockTask({ status: TaskStatus.PENDING });
    const inProgress = createMockTask({ status: TaskStatus.IN_PROGRESS });
    const completed = createMockTask({ status: TaskStatus.COMPLETED });

    const result = groupTasksByStatus([pending, inProgress, completed], TZ);

    expect(result[TaskStatus.PENDING]).toContain(pending);
    expect(result[TaskStatus.IN_PROGRESS]).toContain(inProgress);
    expect(result[TaskStatus.COMPLETED]).toContain(completed);
  });

  it("moves an active past-due task into the OVERDUE bucket", () => {
    // Yesterday in Stockholm
    const overdueTask = createMockTask({
      status: TaskStatus.PENDING,
      dueDate: new Date("2024-06-14T00:00:00Z"),
    });

    const result = groupTasksByStatus([overdueTask], TZ);

    expect(result[OVERDUE_STATUS]).toContain(overdueTask);
  });

  it("does not move CANCELLED tasks to OVERDUE even when past due", () => {
    const cancelledPast = createMockTask({
      status: TaskStatus.CANCELLED,
      dueDate: new Date("2024-06-01T00:00:00Z"),
    });

    const result = groupTasksByStatus([cancelledPast], TZ);

    expect(result[OVERDUE_STATUS]).not.toContain(cancelledPast);
  });

  it("does not move COMPLETED tasks to OVERDUE even when past due", () => {
    const completedPast = createMockTask({
      status: TaskStatus.COMPLETED,
      dueDate: new Date("2024-06-01T00:00:00Z"),
    });

    const result = groupTasksByStatus([completedPast], TZ);

    expect(result[OVERDUE_STATUS]).not.toContain(completedPast);
  });

  it("does not mark tasks without a dueDate as overdue", () => {
    const noDueDate = createMockTask({ status: TaskStatus.PENDING, dueDate: null });

    const result = groupTasksByStatus([noDueDate], TZ);

    expect(result[OVERDUE_STATUS]).not.toContain(noDueDate);
  });

  it("hides a completed recurring task when an active instance of the same template exists", () => {
    const templateId = "c_template_1";
    const completedOld = createMockTask({ status: TaskStatus.COMPLETED, recurringTemplateId: templateId });
    const pendingNew = createMockTask({ status: TaskStatus.PENDING, recurringTemplateId: templateId });

    const result = groupTasksByStatus([completedOld, pendingNew], TZ);

    expect(result[TaskStatus.COMPLETED]).not.toContain(completedOld);
    expect(result[TaskStatus.PENDING]).toContain(pendingNew);
  });

  it("keeps a completed recurring task visible when no active instance exists", () => {
    const templateId = "c_template_2";
    const completedTask = createMockTask({ status: TaskStatus.COMPLETED, recurringTemplateId: templateId });

    const result = groupTasksByStatus([completedTask], TZ);

    expect(result[TaskStatus.COMPLETED]).toContain(completedTask);
  });

  it("hides a cancelled recurring task when an active instance exists", () => {
    const templateId = "c_template_3";
    const cancelledOld = createMockTask({ status: TaskStatus.CANCELLED, recurringTemplateId: templateId });
    const activeNew = createMockTask({ status: TaskStatus.IN_PROGRESS, recurringTemplateId: templateId });

    const result = groupTasksByStatus([cancelledOld, activeNew], TZ);

    expect(result[TaskStatus.CANCELLED]).not.toContain(cancelledOld);
  });
});

// ─── groupTasksForDigest ──────────────────────────────────────────────────────
// System time: Monday 2024-06-10 10:00 UTC = 12:00 Stockholm
// Week (Mon–Sun): 2024-06-10 to 2024-06-16

describe("groupTasksForDigest", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-10T10:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("skips tasks without a dueDate", () => {
    const noDueDate = createMockTask({ dueDate: null });

    const result = groupTasksForDigest([noDueDate], TZ);

    expect(result.overdue).toHaveLength(0);
    expect(result.dueToday).toHaveLength(0);
    expect(result.dueThisWeek).toHaveLength(0);
  });

  it("skips CANCELLED and COMPLETED tasks", () => {
    const cancelled = createMockTask({ status: TaskStatus.CANCELLED, dueDate: new Date("2024-06-10T10:00:00Z") });
    const completed = createMockTask({ status: TaskStatus.COMPLETED, dueDate: new Date("2024-06-10T10:00:00Z") });

    const result = groupTasksForDigest([cancelled, completed], TZ);

    expect(result.dueToday).toHaveLength(0);
  });

  it("categorises a past-due task as overdue", () => {
    const overdue = createMockTask({ dueDate: new Date("2024-06-09T10:00:00Z") });

    const result = groupTasksForDigest([overdue], TZ);

    expect(result.overdue).toContain(overdue);
    expect(result.dueToday).toHaveLength(0);
  });

  it("categorises a task due today correctly", () => {
    const today = createMockTask({ dueDate: new Date("2024-06-10T15:00:00Z") });

    const result = groupTasksForDigest([today], TZ);

    expect(result.dueToday).toContain(today);
    expect(result.overdue).toHaveLength(0);
  });

  it("categorises tasks later this week correctly and returns them sorted by date", () => {
    // Wednesday and Friday are both within the Mon–Sun week
    const friday = createMockTask({ dueDate: new Date("2024-06-14T10:00:00Z") });
    const wednesday = createMockTask({ dueDate: new Date("2024-06-12T10:00:00Z") });

    const result = groupTasksForDigest([friday, wednesday], TZ);

    expect(result.dueThisWeek).toHaveLength(2);
    expect(result.dueThisWeek[0]!.tasks).toContain(wednesday);
    expect(result.dueThisWeek[1]!.tasks).toContain(friday);
  });

  it("groups multiple tasks with the same due date into one entry", () => {
    const a = createMockTask({ dueDate: new Date("2024-06-12T09:00:00Z") });
    const b = createMockTask({ dueDate: new Date("2024-06-12T14:00:00Z") });

    const result = groupTasksForDigest([a, b], TZ);

    expect(result.dueThisWeek).toHaveLength(1);
    expect(result.dueThisWeek[0]!.tasks).toHaveLength(2);
  });
});
