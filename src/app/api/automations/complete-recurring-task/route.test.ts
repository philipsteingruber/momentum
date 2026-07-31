import { TaskStatus } from "@/generated/prisma/enums";
import { createMockTask, createMockUser } from "@/test-utils/factories";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { mockDeep, mockReset, type DeepMockProxy } from "vitest-mock-extended";
import { POST } from "./route";

// ─── Module mocks (must be top-level) ────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({ prisma: mockDeep<PrismaClient>() }));
vi.mock("@/lib/cron-logger", () => ({ cronLog: vi.fn() }));

const { prisma } = await import("@/lib/prisma");
const { cronLog } = await import("@/lib/cron-logger");
const mockDb = prisma as unknown as DeepMockProxy<PrismaClient>;

// ─── Shared test setup ────────────────────────────────────────────────────────

const API_KEY = "test-automation-api-key";
const ADMIN_CLERK_ID = "clerk_admin_id";
const TEMPLATE_ID = "cmn231jfa000004juomibyfyx";

const makeRequest = (body: unknown, headers: Record<string, string> = { authorization: `Bearer ${API_KEY}` }) =>
  new NextRequest("http://localhost/api/automations/complete-recurring-task", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

beforeEach(() => {
  mockReset(mockDb);
  vi.mocked(cronLog).mockClear();
  vi.stubEnv("AUTOMATION_API_KEY", API_KEY);
  vi.stubEnv("ADMIN_CLERK_USER_ID", ADMIN_CLERK_ID);
});

afterEach(() => vi.unstubAllEnvs());

describe("POST /api/automations/complete-recurring-task", () => {
  it("returns 401 when the bearer token is missing", async () => {
    const res = await POST(makeRequest({ recurringTemplateId: TEMPLATE_ID }, {}));

    expect(res.status).toBe(401);
    expect(cronLog).toHaveBeenCalledWith(expect.objectContaining({ event: "auth.failed", level: "error" }));
  });

  it("returns 401 when the bearer token is wrong", async () => {
    const res = await POST(makeRequest({ recurringTemplateId: TEMPLATE_ID }, { authorization: "Bearer wrong-key" }));

    expect(res.status).toBe(401);
  });

  it("returns 401 when the bearer token differs only in length from the expected one", async () => {
    const res = await POST(
      makeRequest({ recurringTemplateId: TEMPLATE_ID }, { authorization: `Bearer ${API_KEY}-extra` }),
    );

    expect(res.status).toBe(401);
  });

  it("rejects every caller when AUTOMATION_API_KEY itself is unset, even with an empty bearer token", async () => {
    vi.stubEnv("AUTOMATION_API_KEY", "");

    const res = await POST(makeRequest({ recurringTemplateId: TEMPLATE_ID }, { authorization: "Bearer " }));

    expect(res.status).toBe(401);
  });

  it("returns 500 when ADMIN_CLERK_USER_ID is not configured", async () => {
    vi.stubEnv("ADMIN_CLERK_USER_ID", "");

    const res = await POST(makeRequest({ recurringTemplateId: TEMPLATE_ID }));

    expect(res.status).toBe(500);
    expect(cronLog).toHaveBeenCalledWith(
      expect.objectContaining({ event: "config.missing_admin_clerk_id", level: "error" }),
    );
  });

  it("returns 400 when recurringTemplateId is missing from the body", async () => {
    const res = await POST(makeRequest({}));

    expect(res.status).toBe(400);
    expect(cronLog).toHaveBeenCalledWith(expect.objectContaining({ event: "body.invalid", level: "error" }));
  });

  it("returns 400 when recurringTemplateId is not a valid cuid", async () => {
    const res = await POST(makeRequest({ recurringTemplateId: "not-a-cuid" }));

    expect(res.status).toBe(400);
  });

  it("returns 500 when no user exists for ADMIN_CLERK_USER_ID", async () => {
    mockDb.user.findUnique.mockResolvedValue(null);

    const res = await POST(makeRequest({ recurringTemplateId: TEMPLATE_ID }));

    expect(res.status).toBe(500);
    expect(cronLog).toHaveBeenCalledWith(expect.objectContaining({ event: "admin_user.not_found", level: "error" }));
  });

  it("returns 404 when the recurring template has no open task instance", async () => {
    mockDb.user.findUnique.mockResolvedValue(createMockUser({ clerkId: ADMIN_CLERK_ID }));
    mockDb.task.findFirst.mockResolvedValue(null);

    const res = await POST(makeRequest({ recurringTemplateId: TEMPLATE_ID }));

    expect(res.status).toBe(404);
    expect(cronLog).toHaveBeenCalledWith(expect.objectContaining({ event: "task.not_found", level: "warn" }));
  });

  it("excludes already-terminal tasks when looking up the open instance", async () => {
    const user = createMockUser({ clerkId: ADMIN_CLERK_ID });
    mockDb.user.findUnique.mockResolvedValue(user);
    mockDb.task.findFirst.mockResolvedValue(null);

    await POST(makeRequest({ recurringTemplateId: TEMPLATE_ID }));

    expect(mockDb.task.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: user.id,
          recurringTemplateId: TEMPLATE_ID,
          status: { notIn: [TaskStatus.COMPLETED, TaskStatus.CANCELLED, TaskStatus.SKIPPED] },
        }),
      }),
    );
  });

  it("marks the current open task instance completed, re-checking status is still open at update time", async () => {
    const user = createMockUser({ clerkId: ADMIN_CLERK_ID });
    const task = createMockTask({ recurringTemplateId: TEMPLATE_ID, status: TaskStatus.PENDING });
    mockDb.user.findUnique.mockResolvedValue(user);
    mockDb.task.findFirst.mockResolvedValue(task);
    mockDb.task.updateMany.mockResolvedValue({ count: 1 });

    await POST(makeRequest({ recurringTemplateId: TEMPLATE_ID }));

    expect(mockDb.task.updateMany).toHaveBeenCalledWith({
      where: { id: task.id, status: { notIn: [TaskStatus.COMPLETED, TaskStatus.CANCELLED, TaskStatus.SKIPPED] } },
      data: { status: TaskStatus.COMPLETED, completedAt: expect.any(Date) as Date },
    });
  });

  it("returns the completed task's id and title in the response body", async () => {
    const user = createMockUser({ clerkId: ADMIN_CLERK_ID });
    const task = createMockTask({
      recurringTemplateId: TEMPLATE_ID,
      status: TaskStatus.PENDING,
      title: "Take Medicine",
    });
    mockDb.user.findUnique.mockResolvedValue(user);
    mockDb.task.findFirst.mockResolvedValue(task);
    mockDb.task.updateMany.mockResolvedValue({ count: 1 });

    const res = await POST(makeRequest({ recurringTemplateId: TEMPLATE_ID }));
    const json = (await res.json()) as { completedTaskId: string; title: string };

    expect(res.status).toBe(200);
    expect(json).toEqual({ completedTaskId: task.id, title: task.title });
  });

  it("logs a task.completed event with the completed task's id", async () => {
    const user = createMockUser({ clerkId: ADMIN_CLERK_ID });
    const task = createMockTask({ recurringTemplateId: TEMPLATE_ID, status: TaskStatus.PENDING });
    mockDb.user.findUnique.mockResolvedValue(user);
    mockDb.task.findFirst.mockResolvedValue(task);
    mockDb.task.updateMany.mockResolvedValue({ count: 1 });

    await POST(makeRequest({ recurringTemplateId: TEMPLATE_ID }));

    expect(cronLog).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "task.completed",
        level: "info",
        data: expect.objectContaining({ taskId: task.id }),
      }),
    );
  });

  it("returns 409 when the task was already completed, cancelled, or skipped by the time of the update", async () => {
    const user = createMockUser({ clerkId: ADMIN_CLERK_ID });
    const task = createMockTask({ recurringTemplateId: TEMPLATE_ID, status: TaskStatus.PENDING });
    mockDb.user.findUnique.mockResolvedValue(user);
    mockDb.task.findFirst.mockResolvedValue(task);
    mockDb.task.updateMany.mockResolvedValue({ count: 0 });

    const res = await POST(makeRequest({ recurringTemplateId: TEMPLATE_ID }));

    expect(res.status).toBe(409);
    expect(cronLog).toHaveBeenCalledWith(expect.objectContaining({ event: "task.already_terminal", level: "warn" }));
  });
});
