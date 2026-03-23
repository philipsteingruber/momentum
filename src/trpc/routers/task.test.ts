/**
 * Demonstration of the tRPC procedure testing pattern.
 *
 * Key setup steps that every tRPC test file needs:
 *  1. vi.mock("@/lib/prisma") — prevents PrismaClient from connecting at import time
 *  2. vi.mock("@clerk/nextjs/server") — prevents Clerk from looking for Next.js internals
 *  3. mockDeep<PrismaClient>() — typed mock for ctx.db, reset between tests
 *  4. createCallerFactory(router)(ctx) — calls procedures directly, bypassing HTTP
 */

import type { Category, Note, Task } from "@/generated/prisma/client";
import { createMockTask, createMockUser, createMockUserSettings } from "@/test-utils/factories";
import type { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockDeep, mockReset } from "vitest-mock-extended";
import type { PrismaClient } from "../../generated/prisma/client";
import { createCallerFactory } from "../init";
import { taskRouter } from "./task";
import type { AuthedContext } from "../init";

// ─── Module mocks (must be top-level) ────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));

// ─── Shared mock setup ────────────────────────────────────────────────────────

const mockDb = mockDeep<PrismaClient>();
const createCaller = createCallerFactory(taskRouter);

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

// ─── task.getById ─────────────────────────────────────────────────────────────

type TaskWithRelations = Task & { notes: Note[]; category: Category | null };

describe("task.getById", () => {
  it("returns the task when found", async () => {
    const task: TaskWithRelations = { ...createMockTask(), notes: [], category: null };
    mockDb.task.findUnique.mockResolvedValue(task);

    const result = await createCaller(makeCtx()).getById({ taskId: task.id });

    expect(result).toEqual(task);
  });

  it("queries with the correct userId scope (cannot fetch another user's task)", async () => {
    const task: TaskWithRelations = { ...createMockTask(), notes: [], category: null };
    mockDb.task.findUnique.mockResolvedValue(task);

    const ctx = makeCtx();
    await createCaller(ctx).getById({ taskId: task.id });

    expect(mockDb.task.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: ctx.currentUser.id }),
      }),
    );
  });

  it("throws NOT_FOUND when the task does not exist", async () => {
    mockDb.task.findUnique.mockResolvedValue(null);

    await expect(createCaller(makeCtx()).getById({ taskId: "clh3as75q0000sn8x93gr2a0g" })).rejects.toThrow(
      expect.objectContaining({ code: "NOT_FOUND" }) as unknown as TRPCError,
    );
  });
});
