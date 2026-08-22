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
  new NextRequest("http://localhost/api/automations/recurring-templates", { headers });

beforeEach(() => {
  mockReset(mockDb);
  vi.mocked(cronLog).mockClear();
  vi.stubEnv("AUTOMATION_API_KEY", API_KEY);
  vi.stubEnv("ADMIN_CLERK_USER_ID", ADMIN_CLERK_ID);
});

afterEach(() => vi.unstubAllEnvs());

describe("GET /api/automations/recurring-templates", () => {
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

  it("returns an empty array when the user has no recurring templates", async () => {
    mockDb.user.findUnique.mockResolvedValue(createMockUser({ clerkId: ADMIN_CLERK_ID }));
    mockDb.recurringTemplate.findMany.mockResolvedValue([]);

    const res = await GET(makeRequest());
    const json = (await res.json()) as unknown[];

    expect(res.status).toBe(200);
    expect(json).toEqual([]);
  });

  it("returns id and title for each of the user's recurring templates, scoped to that user", async () => {
    const user = createMockUser({ clerkId: ADMIN_CLERK_ID });
    mockDb.user.findUnique.mockResolvedValue(user);
    // select: { id, title } narrows the returned shape below RecurringTemplate's
    // full type — cast reflects that Prisma-select narrowing, not a shortcut.
    mockDb.recurringTemplate.findMany.mockResolvedValue([{ id: "t1", title: "Take Medicine" }] as never);

    const res = await GET(makeRequest());
    const json = (await res.json()) as { id: string; title: string }[];

    expect(json).toEqual([{ id: "t1", title: "Take Medicine" }]);
    expect(mockDb.recurringTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: user.id } }),
    );
  });

  it("logs a list event with the returned count", async () => {
    mockDb.user.findUnique.mockResolvedValue(createMockUser({ clerkId: ADMIN_CLERK_ID }));
    mockDb.recurringTemplate.findMany.mockResolvedValue([{ id: "t1", title: "Take Medicine" }] as never);

    await GET(makeRequest());

    expect(cronLog).toHaveBeenCalledWith(
      expect.objectContaining({ event: "list", level: "info", data: { count: 1 } }),
    );
  });
});
