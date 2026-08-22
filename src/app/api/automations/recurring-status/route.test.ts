import { RecurrenceType, TaskStatus } from "@/generated/prisma/enums";
import { createMockUser } from "@/test-utils/factories";
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
  new NextRequest("http://localhost/api/automations/recurring-status", { headers });

const template = (id: string, title: string, recurrenceType: RecurrenceType, tasks: { status: TaskStatus }[]) => ({
  id,
  title,
  recurrenceType,
  tasks,
});

beforeEach(() => {
  mockReset(mockDb);
  vi.mocked(cronLog).mockClear();
  vi.stubEnv("AUTOMATION_API_KEY", API_KEY);
  vi.stubEnv("ADMIN_CLERK_USER_ID", ADMIN_CLERK_ID);
  mockDb.user.findUnique.mockResolvedValue(createMockUser({ clerkId: ADMIN_CLERK_ID }));
});

afterEach(() => vi.unstubAllEnvs());

describe("GET /api/automations/recurring-status", () => {
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
  });

  it("returns 500 when no user exists for ADMIN_CLERK_USER_ID", async () => {
    mockDb.user.findUnique.mockResolvedValue(null);
    const res = await GET(makeRequest());
    expect(res.status).toBe(500);
    expect(cronLog).toHaveBeenCalledWith(expect.objectContaining({ event: "admin_user.not_found", level: "error" }));
  });

  it("returns an empty array when there are no daily/weekly templates", async () => {
    mockDb.recurringTemplate.findMany.mockResolvedValue([]);
    const res = await GET(makeRequest());
    const json = (await res.json()) as unknown[];
    expect(res.status).toBe(200);
    expect(json).toEqual([]);
  });

  it("queries only DAILY and WEEKLY templates, scoped to the admin user", async () => {
    mockDb.recurringTemplate.findMany.mockResolvedValue([]);
    await GET(makeRequest());
    expect(mockDb.recurringTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: expect.any(String), recurrenceType: { in: [RecurrenceType.DAILY, RecurrenceType.WEEKLY] } },
      }),
    );
  });

  it("reports completedThisCycle true when the newest instance is completed", async () => {
    mockDb.recurringTemplate.findMany.mockResolvedValue([
      template("t1", "Dishwasher", RecurrenceType.DAILY, [{ status: TaskStatus.COMPLETED }]),
    ] as never);
    const res = await GET(makeRequest());
    const json = (await res.json()) as { completedThisCycle: boolean }[];
    expect(json[0].completedThisCycle).toBe(true);
  });

  it("reports completedThisCycle false when the newest instance is still pending", async () => {
    mockDb.recurringTemplate.findMany.mockResolvedValue([
      template("t1", "Dishwasher", RecurrenceType.DAILY, [{ status: TaskStatus.PENDING }]),
    ] as never);
    const res = await GET(makeRequest());
    const json = (await res.json()) as { completedThisCycle: boolean }[];
    expect(json[0].completedThisCycle).toBe(false);
  });

  it("counts an unbroken run of completed instances as the streak", async () => {
    mockDb.recurringTemplate.findMany.mockResolvedValue([
      template("t1", "Dishwasher", RecurrenceType.DAILY, [
        { status: TaskStatus.COMPLETED },
        { status: TaskStatus.COMPLETED },
        { status: TaskStatus.COMPLETED },
      ]),
    ] as never);
    const res = await GET(makeRequest());
    const json = (await res.json()) as { currentStreak: number }[];
    expect(json[0].currentStreak).toBe(3);
  });

  it("stops the streak at a cancelled or skipped instance", async () => {
    mockDb.recurringTemplate.findMany.mockResolvedValue([
      template("t1", "Dishwasher", RecurrenceType.DAILY, [
        { status: TaskStatus.COMPLETED },
        { status: TaskStatus.COMPLETED },
        { status: TaskStatus.SKIPPED },
        { status: TaskStatus.COMPLETED },
      ]),
    ] as never);
    const res = await GET(makeRequest());
    const json = (await res.json()) as { currentStreak: number }[];
    expect(json[0].currentStreak).toBe(2);
  });

  it("applies the forgiving rule: a still-pending newest instance doesn't break a prior streak", async () => {
    mockDb.recurringTemplate.findMany.mockResolvedValue([
      template("t1", "Dishwasher", RecurrenceType.DAILY, [
        { status: TaskStatus.PENDING },
        { status: TaskStatus.COMPLETED },
        { status: TaskStatus.COMPLETED },
      ]),
    ] as never);
    const res = await GET(makeRequest());
    const json = (await res.json()) as { currentStreak: number; completedThisCycle: boolean }[];
    expect(json[0].currentStreak).toBe(2);
    expect(json[0].completedThisCycle).toBe(false);
  });

  it("returns a zero streak when the newest resolved instance is cancelled", async () => {
    mockDb.recurringTemplate.findMany.mockResolvedValue([
      template("t1", "Dishwasher", RecurrenceType.DAILY, [{ status: TaskStatus.CANCELLED }]),
    ] as never);
    const res = await GET(makeRequest());
    const json = (await res.json()) as { currentStreak: number }[];
    expect(json[0].currentStreak).toBe(0);
  });

  it("returns id, title, and recurrenceType alongside the computed fields", async () => {
    mockDb.recurringTemplate.findMany.mockResolvedValue([
      template("t1", "Take Medicine", RecurrenceType.WEEKLY, [{ status: TaskStatus.COMPLETED }]),
    ] as never);
    const res = await GET(makeRequest());
    const json = (await res.json()) as unknown[];
    expect(json).toEqual([
      {
        id: "t1",
        title: "Take Medicine",
        recurrenceType: RecurrenceType.WEEKLY,
        completedThisCycle: true,
        currentStreak: 1,
      },
    ]);
  });

  it("logs a list event with the returned count", async () => {
    mockDb.recurringTemplate.findMany.mockResolvedValue([
      template("t1", "Dishwasher", RecurrenceType.DAILY, [{ status: TaskStatus.COMPLETED }]),
    ] as never);
    await GET(makeRequest());
    expect(cronLog).toHaveBeenCalledWith(
      expect.objectContaining({ event: "list", level: "info", data: { count: 1 } }),
    );
  });
});
