/**
 * Tests for recurringTemplate router procedures that create tasks.
 * Same setup as task.test.ts: mocked prisma and clerk, mockDeep client, direct caller.
 */

import type { PrismaClient } from "../../generated/prisma/client";
import { createMockRecurringTemplate, createMockUser, createMockUserSettings } from "@/test-utils/factories";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockDeep, mockReset } from "vitest-mock-extended";
import { createCallerFactory } from "../init";
import { recurringTemplateRouter } from "./recurringTemplate";
import type { AuthedContext } from "../init";

// ─── Module mocks (must be top-level) ────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));
vi.mock("@/lib/cron-logger", () => ({ cronLog: vi.fn() }));

// ─── Shared mock setup ────────────────────────────────────────────────────────

const mockDb = mockDeep<PrismaClient>();
const createCaller = createCallerFactory(recurringTemplateRouter);

function makeCtx(): AuthedContext {
  const user = createMockUser();
  const settings = createMockUserSettings({ userId: user.id });
  return {
    db: mockDb as unknown as PrismaClient,
    auth: { userId: user.clerkId } as AuthedContext["auth"],
    currentUser: { ...user, userSettings: settings },
  };
}

beforeEach(() => mockReset(mockDb));

// ─── recurringTemplate.update ─────────────────────────────────────────────────

describe("recurringTemplate.update", () => {
  it("regenerates the open task without failing when the cycle already has its first session", async () => {
    const template = createMockRecurringTemplate({ recurrenceType: "WEEKLY", dayOfWeek: 3 });
    mockDb.recurringTemplate.findUnique.mockResolvedValue(template);
    mockDb.$transaction.mockImplementation(((fn: (tx: PrismaClient) => Promise<unknown>) =>
      fn(mockDb as unknown as PrismaClient)) as never);
    mockDb.task.updateMany.mockResolvedValue({ count: 0 });
    mockDb.task.createMany.mockResolvedValue({ count: 1 });
    mockDb.recurringTemplate.update.mockResolvedValue(template);

    await createCaller(makeCtx()).update({
      templateId: template.id,
      data: { recurrenceType: "WEEKLY", dayOfWeek: 5 },
    });

    expect(mockDb.task.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skipDuplicates: true,
        data: [expect.objectContaining({ sessionIndex: 1 })],
      }),
    );
  });
  it("keeps the open session when the template is saved without a schedule change", async () => {
    const template = createMockRecurringTemplate({ recurrenceType: "DAILY", dayOfWeek: null });
    mockDb.recurringTemplate.findUnique.mockResolvedValue(template);
    mockDb.$transaction.mockImplementation(((fn: (tx: PrismaClient) => Promise<unknown>) =>
      fn(mockDb as unknown as PrismaClient)) as never);
    mockDb.task.updateMany.mockResolvedValue({ count: 1 });
    mockDb.recurringTemplate.update.mockResolvedValue(template);

    await createCaller(makeCtx()).update({
      templateId: template.id,
      data: { recurrenceType: "DAILY", title: "Renamed" },
    });

    expect(mockDb.task.createMany).not.toHaveBeenCalled();
    expect(mockDb.task.updateMany).toHaveBeenCalledTimes(1);
    expect(mockDb.task.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: { in: expect.arrayContaining(["PENDING"]) } }),
        data: { title: "Renamed" },
      }),
    );
  });
});
