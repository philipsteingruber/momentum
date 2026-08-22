# Recurring Templates List Route Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a read-only `GET /api/automations/recurring-templates` route so an external caller (Nucleus) can discover `recurringTemplateId` values without database access, unblocking Nucleus's habit-editor picker.

**Architecture:** One new Next.js route handler, mirroring `complete-recurring-task/route.ts`'s auth exactly (duplicated, not extracted into a shared helper — matches this codebase's existing one-route-per-file convention; no shared auth lib exists yet for these routes). No schema change, no new env var — reuses `AUTOMATION_API_KEY`/`ADMIN_CLERK_USER_ID`, both already configured for `complete-recurring-task`.

**Tech Stack:** Next.js / Prisma (momentum repo only).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-22-recurring-templates-list-route-design.md` — read it before starting if anything below is ambiguous.
- Read-only: no create/update/delete, no pagination/filtering (see spec's Out of scope).
- Does NOT filter out paused templates — a paused template just won't have an open task instance if selected later (the existing `complete-recurring-task` route already 404s cleanly in that case, per its own tested behavior). Deliberately not adding pause-window logic here; revisit only if this becomes a real point of confusion in practice.
- **This repo is git-integrated with a live Vercel production deployment.** Committing locally is safe; do NOT push to `origin/master` without the user's explicit go-ahead — same precedent as the Bookshelf `reading-status` route (see nucleus repo's `docs/kb/nucleus.md`, 2026-08-20 entries).

---

### Task 1: `GET /api/automations/recurring-templates` route + tests

**Files:**

- Create: `src/app/api/automations/recurring-templates/route.ts`
- Create: `src/app/api/automations/recurring-templates/route.test.ts`

**Interfaces:**

- Produces: `GET /api/automations/recurring-templates` → `200` with `{ id: string; title: string }[]` on success; `401`/`500` matching `complete-recurring-task`'s existing status-code contract for the same failure classes (missing/wrong auth, missing admin config, admin user not found).

- [x] **Step 1: Write the route**

Create `src/app/api/automations/recurring-templates/route.ts`:

```typescript
import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

import { cronLog } from "@/lib/cron-logger";
import { prisma } from "@/lib/prisma";

// Read-only counterpart to complete-recurring-task/route.ts's write path — lets a
// trusted external caller (Nucleus's habit-editor dropdown) discover which
// recurringTemplateId values exist, so it can map a habit to one without direct
// database access. Same auth pattern, deliberately duplicated rather than shared
// (no shared auth helper exists yet for these routes).

const JOB = "automations.recurring-templates";

function isAuthorized(req: NextRequest): boolean {
  const expected = process.env.AUTOMATION_API_KEY;
  if (!expected) return false;
  const header = req.headers.get("authorization");
  if (!header) return false;

  const expectedBuf = Buffer.from(`Bearer ${expected}`);
  const headerBuf = Buffer.from(header);
  if (expectedBuf.length !== headerBuf.length) return false;

  return timingSafeEqual(headerBuf, expectedBuf);
}

export async function GET(req: NextRequest): Promise<Response> {
  const runId = crypto.randomUUID();

  if (!isAuthorized(req)) {
    await cronLog({ runId, job: JOB, event: "auth.failed", level: "error" });
    return new Response("Unauthorized", { status: 401 });
  }

  const clerkId = process.env.ADMIN_CLERK_USER_ID;
  if (!clerkId) {
    await cronLog({ runId, job: JOB, event: "config.missing_admin_clerk_id", level: "error" });
    return new Response("ADMIN_CLERK_USER_ID is not configured", { status: 500 });
  }

  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) {
    await cronLog({ runId, job: JOB, event: "admin_user.not_found", level: "error" });
    return new Response("Admin user not found", { status: 500 });
  }

  const templates = await prisma.recurringTemplate.findMany({
    where: { userId: user.id },
    select: { id: true, title: true },
    orderBy: { title: "asc" },
  });

  await cronLog({ runId, job: JOB, event: "list", level: "info", data: { count: templates.length } });

  return Response.json(templates);
}
```

- [x] **Step 2: Write the tests**

Create `src/app/api/automations/recurring-templates/route.test.ts`:

```typescript
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
```

- [x] **Step 3: Run tests and type-check**

Run: `pnpm test && pnpm tsc --noEmit`
Expected: all tests pass (existing + new), no type errors.

- [x] **Step 4: Commit (do NOT push)**

```bash
cd ~/momentum
git add src/app/api/automations/recurring-templates
git commit -m "feat: add read-only recurring-templates list route

New GET /api/automations/recurring-templates, same Bearer-auth pattern
as complete-recurring-task, lets a trusted external caller (Nucleus's
habit-editor dropdown) discover recurringTemplateId values without
direct database access. Read-only: no create/update/delete, no
pagination — a personal task app for one user has on the order of
tens of templates, not thousands.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01CENKXKunKN9obAaASDX4Sd"
```

**Do not push** — this repo deploys to production on push to `origin/master`. Confirm with the user before pushing.

---

### Task 2: Deploy and verify (user-gated)

**Files:** none (operational task).

- [ ] **Step 1: Ask the user to push and confirm the Vercel deploy**

Not automatable from here — same precedent as the Bookshelf `reading-status` route.

- [ ] **Step 2: Verify against production**

Once deployed, confirm with a real request (values from the user's actual `AUTOMATION_API_KEY`):

```bash
curl -s -H "Authorization: Bearer $AUTOMATION_API_KEY" https://<momentum-prod-url>/api/automations/recurring-templates
```

Expected: `200` with a JSON array of `{id, title}` objects matching the user's real recurring templates.
