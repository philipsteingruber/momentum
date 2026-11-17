import type { Prisma } from "@/generated/prisma/client";
import { TaskStatus } from "@/generated/prisma/enums";
import { createMockRecurringTemplate, createMockTask } from "@/test-utils/factories";
import { beforeEach, describe, expect, it } from "vitest";
import { mockDeep, mockReset } from "vitest-mock-extended";
import { TaskNotFoundError, applyTaskStatusChange } from "./apply-task-status-change";

const tx = mockDeep<Prisma.TransactionClient>();
const cycleStart = new Date("2026-11-17T23:00:00Z");
const template = createMockRecurringTemplate({ id: "c_template", title: "Brush teeth", timesPerCycle: 2 });

const withTemplate = (overrides: Parameters<typeof createMockTask>[0]) => ({
  ...createMockTask({ recurringTemplateId: template.id, cycleStart, dueDate: cycleStart, ...overrides }),
  recurringTemplate: template,
});

beforeEach(() => mockReset(tx));

describe("applyTaskStatusChange", () => {
  it("creates the next session with duplicates skipped when a session below the target is completed", async () => {
    const task = withTemplate({ sessionIndex: 1, status: TaskStatus.PENDING });
    tx.task.findFirst.mockResolvedValue(task);
    tx.task.update.mockResolvedValue({ ...task, status: TaskStatus.COMPLETED });

    await applyTaskStatusChange(tx, { taskId: task.id, userId: task.userId, newStatus: TaskStatus.COMPLETED });

    expect(tx.task.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          title: "Brush teeth",
          status: TaskStatus.PENDING,
          recurringTemplateId: template.id,
          cycleStart,
          sessionIndex: 2,
          dueDate: cycleStart,
        }),
      ],
      skipDuplicates: true,
    });
  });

  it("deletes the open next session when a completed session is reopened", async () => {
    const task = withTemplate({ sessionIndex: 1, status: TaskStatus.COMPLETED });
    tx.task.findFirst.mockResolvedValue(task);
    tx.task.update.mockResolvedValue({ ...task, status: TaskStatus.PENDING });

    await applyTaskStatusChange(tx, { taskId: task.id, userId: task.userId, newStatus: TaskStatus.PENDING });

    expect(tx.task.deleteMany).toHaveBeenCalledWith({
      where: {
        recurringTemplateId: template.id,
        cycleStart,
        sessionIndex: 2,
        status: { in: [TaskStatus.PENDING, TaskStatus.IN_PROGRESS, TaskStatus.BLOCKED] },
      },
    });
  });

  it("stamps completedAt when a task is completed", async () => {
    const task = withTemplate({ sessionIndex: 2, status: TaskStatus.PENDING });
    tx.task.findFirst.mockResolvedValue(task);
    tx.task.update.mockResolvedValue(task);

    await applyTaskStatusChange(tx, { taskId: task.id, userId: task.userId, newStatus: TaskStatus.COMPLETED });

    expect(tx.task.update).toHaveBeenCalledWith({
      where: { id: task.id },
      data: { status: TaskStatus.COMPLETED, completedAt: expect.any(Date) },
    });
  });

  it("throws TaskNotFoundError when the task does not belong to the user", async () => {
    tx.task.findFirst.mockResolvedValue(null);

    await expect(
      applyTaskStatusChange(tx, { taskId: "c_missing", userId: "c_user", newStatus: TaskStatus.COMPLETED }),
    ).rejects.toBeInstanceOf(TaskNotFoundError);
  });
});
