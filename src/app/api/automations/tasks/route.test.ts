import { TaskStatus } from "@/generated/prisma/enums";
import { createMockUser, createMockUserSettings } from "@/test-utils/factories";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { mockDeep, mockReset, type DeepMockProxy } from "vitest-mock-extended";
import { GET } from "./route";

vi.mock("@/lib/prisma", () => ({ prisma: mockDeep<PrismaClient>() }));
vi.mock("@/lib/cron-logger", () => ({ cronLog: vi.fn() }));

const { prisma } = await import("@/lib/prisma");
const { cronLog } = await import("@/lib/cron-logger");
const mockDb = prisma as unknown as DeepMockProxy<PrismaClient>;

const API_KEY = "test-automation-api-key";
const ADMIN_CLERK_ID = "clerk_admin_id";

const makeRequest = (headers: Record<string, string> = { authorization: `Bearer ${API_KEY}` }) =>
  new NextRequest("http://localhost/api/automations/tasks", { headers });

const userWithSettings = (timezone = "Europe/Stockholm") => ({
  ...createMockUser({ clerkId: ADMIN_CLERK_ID }),
  userSettings: createMockUserSettings({ timezone }),
});

beforeEach(() => {
  mockReset(mockDb);
  vi.mocked(cronLog).mockClear();
  vi.stubEnv("AUTOMATION_API_KEY", API_KEY);
  vi.stubEnv("ADMIN_CLERK_USER_ID", ADMIN_CLERK_ID);
});

afterEach(() => vi.unstubAllEnvs());

describe("GET /api/automations/tasks", () => {
  it("returns 401 when the bearer token is missing", async () => {
    const res = await GET(makeRequest({}));
    expect(res.status).toBe(401);
    expect(cronLog).toHaveBeenCalledWith(expect.objectContaining({ event: "auth.failed", level: "error" }));
  });

  it("returns 401 when the bearer token is wrong", async () => {
    const res = await GET(makeRequest({ authorization: "Bearer wrong-key" }));
    expect(res.status).toBe(401);
  });

  it("returns 500 when ADMIN_CLERK_USER_ID is not configured", async () => {
    vi.stubEnv("ADMIN_CLERK_USER_ID", "");
    const res = await GET(makeRequest());
    expect(res.status).toBe(500);
    expect(cronLog).toHaveBeenCalledWith(
      expect.objectContaining({ event: "config.missing_admin_clerk_id", level: "error" }),
    );
  });

  it("returns 500 when no user exists for ADMIN_CLERK_USER_ID", async () => {
    mockDb.user.findUnique.mockResolvedValue(null);
    const res = await GET(makeRequest());
    expect(res.status).toBe(500);
    expect(cronLog).toHaveBeenCalledWith(expect.objectContaining({ event: "admin_user.not_found", level: "error" }));
  });

  it("returns an empty array when there are no active tasks", async () => {
    mockDb.user.findUnique.mockResolvedValue(userWithSettings() as never);
    mockDb.task.findMany.mockResolvedValue([]);

    const res = await GET(makeRequest());
    const json = (await res.json()) as unknown[];

    expect(res.status).toBe(200);
    expect(json).toEqual([]);
  });

  it("excludes completed, cancelled, and skipped tasks from the query", async () => {
    mockDb.user.findUnique.mockResolvedValue(userWithSettings() as never);
    mockDb.task.findMany.mockResolvedValue([]);

    await GET(makeRequest());

    expect(mockDb.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { notIn: [TaskStatus.COMPLETED, TaskStatus.CANCELLED, TaskStatus.SKIPPED] },
        }),
      }),
    );
  });

  it("orders by due date ascending with nulls last", async () => {
    mockDb.user.findUnique.mockResolvedValue(userWithSettings() as never);
    mockDb.task.findMany.mockResolvedValue([]);

    await GET(makeRequest());

    expect(mockDb.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }] }),
    );
  });

  it("formats a task's due date in the admin user's configured timezone", async () => {
    mockDb.user.findUnique.mockResolvedValue(userWithSettings("America/New_York") as never);
    mockDb.task.findMany.mockResolvedValue([
      { id: "t1", title: "Take out trash", dueDate: new Date("2026-08-23T02:30:00Z"), status: TaskStatus.PENDING },
    ] as never);

    const res = await GET(makeRequest());
    const json = (await res.json()) as { dueDate: string | null }[];

    // 2026-08-23T02:30:00Z is still 2026-08-22 evening in America/New_York.
    expect(json[0].dueDate).toBe("2026-08-22");
  });

  it("returns null dueDate for a task with no due date, without throwing", async () => {
    mockDb.user.findUnique.mockResolvedValue(userWithSettings() as never);
    mockDb.task.findMany.mockResolvedValue([
      { id: "t1", title: "Someday task", dueDate: null, status: TaskStatus.PENDING },
    ] as never);

    const res = await GET(makeRequest());
    const json = (await res.json()) as { dueDate: string | null }[];

    expect(json[0].dueDate).toBeNull();
  });

  it("returns id, title, dueDate, and status for each active task", async () => {
    mockDb.user.findUnique.mockResolvedValue(userWithSettings("UTC") as never);
    mockDb.task.findMany.mockResolvedValue([
      { id: "t1", title: "Water plants", dueDate: new Date("2026-08-25T00:00:00Z"), status: TaskStatus.PENDING },
    ] as never);

    const res = await GET(makeRequest());
    const json = (await res.json()) as unknown[];

    expect(json).toEqual([{ id: "t1", title: "Water plants", dueDate: "2026-08-25", status: TaskStatus.PENDING }]);
  });

  it("falls back to UTC when the admin user has no userSettings row", async () => {
    mockDb.user.findUnique.mockResolvedValue({ ...createMockUser({ clerkId: ADMIN_CLERK_ID }), userSettings: null } as never);
    mockDb.task.findMany.mockResolvedValue([
      { id: "t1", title: "No timezone task", dueDate: new Date("2026-08-25T00:00:00Z"), status: TaskStatus.PENDING },
    ] as never);

    const res = await GET(makeRequest());
    const json = (await res.json()) as { dueDate: string | null }[];

    expect(json[0].dueDate).toBe("2026-08-25");
  });

  it("logs a list event with the returned count", async () => {
    mockDb.user.findUnique.mockResolvedValue(userWithSettings() as never);
    mockDb.task.findMany.mockResolvedValue([
      { id: "t1", title: "Water plants", dueDate: null, status: TaskStatus.PENDING },
    ] as never);

    await GET(makeRequest());

    expect(cronLog).toHaveBeenCalledWith(
      expect.objectContaining({ event: "list", level: "info", data: { count: 1 } }),
    );
  });
});
