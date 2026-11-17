# Multi-session Recurring Tasks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a recurring template require N completions per cycle (e.g. brush teeth 2x/day), modelled as N sequential Task rows ("sessions") per cycle.

**Architecture:** A template gains `timesPerCycle`; each Task gains `cycleStart` + `sessionIndex`, with a unique constraint guarding against duplicate sessions. A pure planner (`planStatusChange`) decides whether a status change spawns or deletes the next session, and a thin server executor (`applyTaskStatusChange`) applies it inside a transaction for tRPC and Discord. The kanban board shows one card per cycle with an `x/y` badge; stats group sessions into cycles before computing streaks.

**Tech Stack:** Next.js App Router, tRPC, Prisma 7 (Postgres, `prisma db push`), Vitest + vitest-mock-extended, ShadCN UI, next-intl, dnd-kit.

**Spec:** `docs/superpowers/specs/2026-11-17-multi-session-recurring-tasks-design.md`

## Global Constraints

- Package manager: pnpm only (`pnpm dlx`, never `npx`).
- Schema changes are applied with `pnpm prisma db push` — never migrations. `src/generated` is gitignored; run `pnpm prisma generate` after editing `schema.prisma`.
- 2-space indentation, double quotes, Prettier formatting, no explicit `any`.
- Use ShadCN components (`@/components/ui/*`) for all UI; the `Badge` component already has `completed` and `in_progress` variants.
- All user-facing web strings go through next-intl in both `messages/en.json` and `messages/sv.json`. Discord output is i18n-unaware (plain English).
- Weeks start on Monday; all date logic is timezone-aware.
- Test names read as "it ..." sentences, describe one behaviour, no "should"/"correctly"/magic numbers. Tests are co-located (`foo.ts` → `foo.test.ts`).
- `timesPerCycle` is an integer from 1 to 10, default 1. Templates with `timesPerCycle = 1` must behave exactly as before.
- The HA endpoint `src/app/api/automations/complete-recurring-task/route.ts` is **not** changed.
- Verification commands: `pnpm vitest run <path>`, `pnpm exec tsc --noEmit`, `pnpm lint`.

## Spec deltas (found while reading the code — apply to the spec in Task 12)

1. **Done-column visibility:** `groupTasksByStatus` currently hides a recurring template's terminal instance whenever the template has an active task. That would hide the "1/2" Done card the moment session 2 spawns. It must only hide terminal instances from a *different* cycle (Task 6).
2. **Duplicate-spawn handling:** a caught `P2002` inside an interactive Postgres transaction aborts the transaction, so later statements in it fail. Use `createMany({ skipDuplicates: true })` (`ON CONFLICT DO NOTHING`) instead of catching `P2002` (Task 3).
3. **Other task-creation paths:** `recurringTemplate.create` and `recurringTemplate.update` (schedule change) also create recurring tasks and must set cycle fields. The schedule-change path cancels active tasks; those must be detached (`cycleStart`/`sessionIndex` set to null), otherwise re-selecting the same due date collides on the unique constraint (Task 4).
4. **Stats query:** keep the single `recurringTemplate.findMany` with a nested `tasks` include using `take: HISTORY_LOOKBACK * MAX_TIMES_PER_CYCLE` instead of one query per template. This keeps the existing route tests' mock shape valid (Task 10).
5. **Optimistic invalidation:** `task-list.tsx` already invalidates `task.getAll` in `onSettled` for every status change, so no new invalidation is needed (Task 7).
6. **Backfill order:** `db push` first (all-NULL columns can't violate the unique constraint), then backfill. The backfill checks for collisions before writing (Task 1).

---

## File Structure

| File | Responsibility |
| --- | --- |
| `prisma/schema.prisma` (modify) | `timesPerCycle`, `cycleStart`, `sessionIndex`, unique constraint |
| `scripts/backfill-recurring-cycles.ts` (create) | One-off: collision check, then set cycle fields on existing recurring tasks |
| `src/lib/recurring-sessions.ts` (create) | **Pure, client-safe** session logic: `planStatusChange`, `firstSessionFields`, `getSessionProgress`, `formatSessionProgress`, `appendSessionProgress`, `applyOptimisticStatusChange`, `isOptimisticPlaceholderId`, `MAX_TIMES_PER_CYCLE` |
| `src/lib/apply-task-status-change.ts` (create) | **Server-only** executor using a Prisma transaction client |
| `src/lib/recurring-cycles.ts` (create) | Pure `groupIntoCycles` for stats |
| `src/_components/session-badge.tsx` (create) | ShadCN `Badge` rendering `x/y` |
| `src/trpc/routers/task.ts`, `src/app/api/discord/interactions/route.ts` | Call the executor |
| `src/app/api/cron/generate-tasks/route.ts`, `src/trpc/routers/recurringTemplate.ts` | Set cycle fields on created tasks |
| `src/lib/task-utils.ts` | Cycle-aware Done-column visibility |
| `src/_components/task-view/task-list.tsx`, `src/_components/kanban/*` | Optimistic transform, badge, placeholder |
| `src/lib/schemas.ts`, `src/_components/forms/*`, `messages/*.json` | `timesPerCycle` input |
| `src/app/api/automations/recurring-status/route.ts` | Group into cycles |
| `src/app/api/cron/daily-digest/route.ts`, `scripts/momentum-cli.ts` | Progress suffix, CLI flags |

The pure module is split from the executor so client components can import `recurring-sessions.ts` without pulling Prisma runtime code into the browser bundle.

---

### Task 1: Schema, factories, backfill script

**Files:**

- Modify: `prisma/schema.prisma:55-88` (Task), `prisma/schema.prisma:102-126` (RecurringTemplate)
- Modify: `src/test-utils/factories.ts`
- Create: `scripts/backfill-recurring-cycles.ts`

**Interfaces:**

- Produces: `Task.cycleStart: Date | null`, `Task.sessionIndex: number | null`, `RecurringTemplate.timesPerCycle: number` on the generated Prisma types; factories default `cycleStart: null`, `sessionIndex: null`, `timesPerCycle: 1`.

- [ ] **Step 1: Edit the schema**

In `model RecurringTemplate`, after `pausedUntil DateTime?`:

```prisma
    timesPerCycle  Int            @default(1)
```

In `model Task`, after `recurringTemplateId String?`:

```prisma
    cycleStart          DateTime?
    sessionIndex        Int?
```

and after the existing `@@index([userId, recurringTemplateId, status])`:

```prisma
    @@unique([recurringTemplateId, cycleStart, sessionIndex])
```

- [ ] **Step 2: Regenerate the client**

Run: `pnpm prisma generate`
Expected: "Generated Prisma Client" into `src/generated/prisma`.

- [ ] **Step 3: Update factories so they satisfy the new types**

In `src/test-utils/factories.ts`, `createMockTask` gains (before `createdAt`):

```ts
  cycleStart: null,
  sessionIndex: null,
```

`createMockRecurringTemplate` gains (after `pausedUntil: null,`):

```ts
  timesPerCycle: 1,
```

- [ ] **Step 4: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: PASS. If anything other than factories fails, it's a place constructing a full `Task`/`RecurringTemplate` literal — add the same defaults there.

- [ ] **Step 5: Write the backfill script**

Create `scripts/backfill-recurring-cycles.ts`:

```ts
import "dotenv/config";
import { prisma } from "@/lib/prisma";

// One-off: give every existing recurring task its cycle fields.
// Aborts without writing if two tasks of the same template share a dueDate,
// because they would collide on @@unique([recurringTemplateId, cycleStart, sessionIndex]).
async function main() {
  const collisions = await prisma.$queryRaw<{ recurringTemplateId: string; dueDate: Date; count: bigint }[]>`
    SELECT "recurringTemplateId", "dueDate", COUNT(*) AS count
    FROM "Task"
    WHERE "recurringTemplateId" IS NOT NULL AND "dueDate" IS NOT NULL
    GROUP BY "recurringTemplateId", "dueDate"
    HAVING COUNT(*) > 1
  `;

  if (collisions.length > 0) {
    console.error(`Found ${collisions.length} (template, dueDate) collisions — resolve before backfilling:`);
    for (const c of collisions) {
      console.error(`  template ${c.recurringTemplateId}  dueDate ${c.dueDate.toISOString()}  rows ${c.count}`);
    }
    process.exitCode = 1;
    return;
  }

  const isDryRun = process.argv.includes("--dry-run");
  const toUpdate = await prisma.task.count({
    where: { recurringTemplateId: { not: null }, dueDate: { not: null }, cycleStart: null },
  });
  console.log(`${toUpdate} recurring tasks need cycle fields.`);
  if (isDryRun) return;

  const updated = await prisma.$executeRaw`
    UPDATE "Task"
    SET "cycleStart" = "dueDate", "sessionIndex" = 1
    WHERE "recurringTemplateId" IS NOT NULL AND "dueDate" IS NOT NULL AND "cycleStart" IS NULL
  `;
  console.log(`Backfilled ${updated} tasks.`);
}

main()
  .catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
```

Check the raw column names against the memory note on raw SQL quirks: `RecurringTemplate.nextGenerateOn` is mapped to `nextDueDate`, but the `Task` columns used here are not mapped, so `"dueDate"`, `"cycleStart"` and `"recurringTemplateId"` are correct.

- [ ] **Step 6: Commit** (no DB push yet — that happens in Task 12 with user confirmation)

```bash
git add prisma/schema.prisma src/test-utils/factories.ts scripts/backfill-recurring-cycles.ts
git commit -m "feat(recurring): add session cycle fields to schema with backfill script"
```

---

### Task 2: Pure session planner and progress helpers

**Files:**

- Create: `src/lib/recurring-sessions.ts`
- Test: `src/lib/recurring-sessions.test.ts`

**Interfaces:**

- Consumes: Task 1 types.
- Produces:

```ts
export const MAX_TIMES_PER_CYCLE = 10;
export type SessionTask = Pick<Task, "status" | "recurringTemplateId" | "cycleStart" | "sessionIndex">;
export type StatusChangeAction =
  | { kind: "spawnNextSession"; cycleStart: Date; sessionIndex: number }
  | { kind: "deleteOpenNextSession"; cycleStart: Date; sessionIndex: number };
export function planStatusChange(task: SessionTask, timesPerCycle: number, newStatus: TaskStatus): StatusChangeAction[];
export function firstSessionFields(dueDate: Date): { cycleStart: Date; sessionIndex: number };
export type SessionProgress = { done: number; target: number; isComplete: boolean };
export function getSessionProgress(task: Pick<Task, "status" | "sessionIndex">, timesPerCycle: number): SessionProgress | null;
export function formatSessionProgress(progress: SessionProgress): string; // "1/2"
export function appendSessionProgress(title: string, task: Pick<Task, "status" | "sessionIndex">, timesPerCycle: number): string;
```

- [ ] **Step 1: Write the failing tests**

Create `src/lib/recurring-sessions.test.ts`:

```ts
import { TaskStatus } from "@/generated/prisma/enums";
import { describe, expect, it } from "vitest";
import {
  appendSessionProgress,
  firstSessionFields,
  formatSessionProgress,
  getSessionProgress,
  planStatusChange,
} from "./recurring-sessions";

const cycleStart = new Date("2026-11-17T23:00:00Z");
const session = (sessionIndex: number, status: TaskStatus = TaskStatus.PENDING) => ({
  status,
  recurringTemplateId: "c_template",
  cycleStart,
  sessionIndex,
});

describe("planStatusChange", () => {
  it("spawns the next session when a session below the target is completed", () => {
    expect(planStatusChange(session(1), 2, TaskStatus.COMPLETED)).toEqual([
      { kind: "spawnNextSession", cycleStart, sessionIndex: 2 },
    ]);
  });

  it("spawns nothing when the final session is completed", () => {
    expect(planStatusChange(session(2), 2, TaskStatus.COMPLETED)).toEqual([]);
  });

  it("spawns nothing for a single-session template", () => {
    expect(planStatusChange(session(1), 1, TaskStatus.COMPLETED)).toEqual([]);
  });

  it("spawns nothing when a session is skipped", () => {
    expect(planStatusChange(session(1), 2, TaskStatus.SKIPPED)).toEqual([]);
  });

  it("deletes the open next session when a completed session is reopened", () => {
    expect(planStatusChange(session(1, TaskStatus.COMPLETED), 2, TaskStatus.PENDING)).toEqual([
      { kind: "deleteOpenNextSession", cycleStart, sessionIndex: 2 },
    ]);
  });

  it("deletes the open next session when a completed session is cancelled", () => {
    expect(planStatusChange(session(1, TaskStatus.COMPLETED), 2, TaskStatus.CANCELLED)).toEqual([
      { kind: "deleteOpenNextSession", cycleStart, sessionIndex: 2 },
    ]);
  });

  it("plans nothing for a task without cycle fields", () => {
    const task = { status: TaskStatus.PENDING, recurringTemplateId: null, cycleStart: null, sessionIndex: null };
    expect(planStatusChange(task, 2, TaskStatus.COMPLETED)).toEqual([]);
  });

  it("plans nothing when the status does not change", () => {
    expect(planStatusChange(session(1, TaskStatus.COMPLETED), 2, TaskStatus.COMPLETED)).toEqual([]);
  });
});

describe("firstSessionFields", () => {
  it("starts a cycle at session one anchored to the due date", () => {
    expect(firstSessionFields(cycleStart)).toEqual({ cycleStart, sessionIndex: 1 });
  });
});

describe("getSessionProgress", () => {
  it("returns no progress for a single-session template", () => {
    expect(getSessionProgress(session(1), 1)).toBeNull();
  });

  it("counts a completed session as done for the completed card", () => {
    expect(getSessionProgress(session(1, TaskStatus.COMPLETED), 2)).toEqual({ done: 1, target: 2, isComplete: false });
  });

  it("counts only earlier sessions as done for an open card", () => {
    expect(getSessionProgress(session(2), 2)).toEqual({ done: 1, target: 2, isComplete: false });
  });

  it("marks the cycle complete when the final session is completed", () => {
    expect(getSessionProgress(session(2, TaskStatus.COMPLETED), 2)?.isComplete).toBe(true);
  });
});

describe("formatSessionProgress", () => {
  it("formats progress as done over target", () => {
    expect(formatSessionProgress({ done: 1, target: 3, isComplete: false })).toBe("1/3");
  });
});

describe("appendSessionProgress", () => {
  it("appends progress in parentheses for a multi-session task", () => {
    expect(appendSessionProgress("Brush teeth", session(2), 2)).toBe("Brush teeth (1/2)");
  });

  it("leaves the title unchanged for a single-session task", () => {
    expect(appendSessionProgress("Brush teeth", session(1), 1)).toBe("Brush teeth");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest run src/lib/recurring-sessions.test.ts`
Expected: FAIL — cannot resolve `./recurring-sessions`.

- [ ] **Step 3: Implement**

Create `src/lib/recurring-sessions.ts`:

```ts
import type { Task } from "@/generated/prisma/client";
import { TaskStatus } from "@/generated/prisma/enums";

// Client-safe: no Prisma runtime imports. Server-side execution lives in apply-task-status-change.ts.

export const MAX_TIMES_PER_CYCLE = 10;

export type SessionTask = Pick<Task, "status" | "recurringTemplateId" | "cycleStart" | "sessionIndex">;

export type StatusChangeAction =
  | { kind: "spawnNextSession"; cycleStart: Date; sessionIndex: number }
  | { kind: "deleteOpenNextSession"; cycleStart: Date; sessionIndex: number };

/**
 * Decides what a status change means for the rest of the cycle.
 * Completing session k (k < target) spawns session k+1. Leaving COMPLETED
 * removes the not-yet-finished session k+1, so a cycle never has two open sessions.
 */
export function planStatusChange(
  task: SessionTask,
  timesPerCycle: number,
  newStatus: TaskStatus,
): StatusChangeAction[] {
  if (!task.recurringTemplateId || !task.cycleStart || task.sessionIndex === null) return [];
  if (task.status === newStatus) return [];

  const next = { cycleStart: task.cycleStart, sessionIndex: task.sessionIndex + 1 };

  if (newStatus === TaskStatus.COMPLETED && task.sessionIndex < timesPerCycle) {
    return [{ kind: "spawnNextSession", ...next }];
  }
  if (task.status === TaskStatus.COMPLETED) {
    return [{ kind: "deleteOpenNextSession", ...next }];
  }
  return [];
}

export function firstSessionFields(dueDate: Date): { cycleStart: Date; sessionIndex: number } {
  return { cycleStart: dueDate, sessionIndex: 1 };
}

export type SessionProgress = { done: number; target: number; isComplete: boolean };

/**
 * Sessions are created strictly in order, so a task's own sessionIndex tells us
 * how many sessions of its cycle are done: all of them up to itself if it is
 * completed, all before it otherwise.
 */
export function getSessionProgress(
  task: Pick<Task, "status" | "sessionIndex">,
  timesPerCycle: number,
): SessionProgress | null {
  if (timesPerCycle <= 1 || task.sessionIndex === null) return null;
  const done = task.status === TaskStatus.COMPLETED ? task.sessionIndex : task.sessionIndex - 1;
  return { done, target: timesPerCycle, isComplete: done >= timesPerCycle };
}

export function formatSessionProgress(progress: SessionProgress): string {
  return `${progress.done}/${progress.target}`;
}

export function appendSessionProgress(
  title: string,
  task: Pick<Task, "status" | "sessionIndex">,
  timesPerCycle: number,
): string {
  const progress = getSessionProgress(task, timesPerCycle);
  return progress ? `${title} (${formatSessionProgress(progress)})` : title;
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm vitest run src/lib/recurring-sessions.test.ts`
Expected: PASS (16 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/recurring-sessions.ts src/lib/recurring-sessions.test.ts
git commit -m "feat(recurring): add pure session planner and progress helpers"
```

---

### Task 3: Server executor, wired into `task.updateStatus` and Discord `/complete`

**Files:**

- Create: `src/lib/apply-task-status-change.ts`
- Test: `src/lib/apply-task-status-change.test.ts`
- Modify: `src/trpc/routers/task.ts:145-167` (`updateStatus`)
- Modify: `src/app/api/discord/interactions/route.ts:84-130` (`handleComplete`)
- Test: `src/trpc/routers/task.test.ts` (add `describe("task.updateStatus")`)

**Interfaces:**

- Consumes: `planStatusChange` from Task 2.
- Produces:

```ts
export class TaskNotFoundError extends Error {}
export type TaskStatusChangeResult = { task: Task; timesPerCycle: number };
export async function applyTaskStatusChange(
  tx: Prisma.TransactionClient,
  params: { taskId: string; userId: string; newStatus: TaskStatus },
): Promise<TaskStatusChangeResult>;
```

- [ ] **Step 1: Write the failing executor tests**

Create `src/lib/apply-task-status-change.test.ts`:

```ts
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
```

If `tx.task.findFirst.mockResolvedValue(task)` complains about the include shape, cast the fixture with `as never` at that call only — never `any`.

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest run src/lib/apply-task-status-change.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the executor**

Create `src/lib/apply-task-status-change.ts`:

```ts
import type { Prisma, Task } from "@/generated/prisma/client";
import { TaskStatus } from "@/generated/prisma/enums";
import { planStatusChange } from "@/lib/recurring-sessions";
import { ACTIVE_TASK_STATUSES, TERMINAL_TASK_STATUSES } from "@/lib/task-utils";

export class TaskNotFoundError extends Error {
  constructor(taskId: string) {
    super(`Task ${taskId} not found`);
    this.name = "TaskNotFoundError";
  }
}

export type TaskStatusChangeResult = { task: Task; timesPerCycle: number };

/**
 * The single place a task's status changes, for every caller except the HA endpoint
 * (see the spec's Future work). Must run inside a transaction so the status update
 * and the session spawn/delete commit together.
 */
export async function applyTaskStatusChange(
  tx: Prisma.TransactionClient,
  { taskId, userId, newStatus }: { taskId: string; userId: string; newStatus: TaskStatus },
): Promise<TaskStatusChangeResult> {
  const existing = await tx.task.findFirst({
    where: { id: taskId, userId },
    include: { recurringTemplate: true },
  });
  if (!existing) throw new TaskNotFoundError(taskId);

  const isTerminal = (TERMINAL_TASK_STATUSES as readonly TaskStatus[]).includes(newStatus);
  const task = await tx.task.update({
    where: { id: taskId },
    data: { status: newStatus, completedAt: isTerminal ? new Date() : null },
  });

  const template = existing.recurringTemplate;
  const timesPerCycle = template?.timesPerCycle ?? 1;
  if (!template) return { task, timesPerCycle };

  for (const action of planStatusChange(existing, timesPerCycle, newStatus)) {
    if (action.kind === "spawnNextSession") {
      // skipDuplicates = ON CONFLICT DO NOTHING. A concurrent completion that already spawned this
      // session is a no-op instead of a P2002, which would abort the whole Postgres transaction.
      await tx.task.createMany({
        data: [
          {
            title: template.title,
            description: template.description,
            externalContact: template.externalContact,
            link: template.link,
            reminderTime: template.reminderTime,
            categoryId: template.categoryId,
            status: TaskStatus.PENDING,
            dueDate: existing.dueDate,
            userId,
            recurringTemplateId: template.id,
            cycleStart: action.cycleStart,
            sessionIndex: action.sessionIndex,
          },
        ],
        skipDuplicates: true,
      });
    } else {
      await tx.task.deleteMany({
        where: {
          recurringTemplateId: template.id,
          cycleStart: action.cycleStart,
          sessionIndex: action.sessionIndex,
          status: { in: [...ACTIVE_TASK_STATUSES] },
        },
      });
    }
  }

  return { task, timesPerCycle };
}
```

- [ ] **Step 4: Run executor tests**

Run: `pnpm vitest run src/lib/apply-task-status-change.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Write the failing router test**

Append to `src/trpc/routers/task.test.ts`:

```ts
// ─── task.updateStatus ────────────────────────────────────────────────────────

describe("task.updateStatus", () => {
  it("throws NOT_FOUND when the task does not belong to the user", async () => {
    mockDb.$transaction.mockImplementation(((fn: (tx: PrismaClient) => Promise<unknown>) =>
      fn(mockDb as unknown as PrismaClient)) as never);
    mockDb.task.findFirst.mockResolvedValue(null);

    await expect(
      createCaller(makeCtx()).updateStatus({ taskId: "cxxxxxxx00000000000000001", newStatus: "COMPLETED" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" } satisfies Partial<TRPCError>);
  });
});
```

Run: `pnpm vitest run src/trpc/routers/task.test.ts`
Expected: FAIL — the current implementation calls `task.update`, not `findFirst`, and gets `undefined` back.

- [ ] **Step 6: Rewire `updateStatus`**

Replace the `updateStatus` mutation body in `src/trpc/routers/task.ts`:

```ts
  updateStatus: authedProcedure
    .input(z.object({ taskId: z.cuid(), newStatus: z.enum(TaskStatus) }))
    .mutation(async ({ ctx, input }) => {
      try {
        const { task } = await ctx.db.$transaction((tx) =>
          applyTaskStatusChange(tx, { taskId: input.taskId, userId: ctx.currentUser.id, newStatus: input.newStatus }),
        );
        return task;
      } catch (err) {
        if (err instanceof TaskNotFoundError) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }
        throw err;
      }
    }),
```

Add the import `import { TaskNotFoundError, applyTaskStatusChange } from "@/lib/apply-task-status-change";`. If `TERMINAL_TASK_STATUSES` is now unused in `task.ts`, keep it — `getAll` still uses it.

- [ ] **Step 7: Rewire Discord `/complete`**

In `src/app/api/discord/interactions/route.ts` `handleComplete`, replace the `await prisma.task.update({ ... COMPLETED ... })` call and the success embed with:

```ts
  const { task: completed, timesPerCycle } = await prisma.$transaction((tx) =>
    applyTaskStatusChange(tx, { taskId, userId, newStatus: TaskStatus.COMPLETED }),
  );

  await followUpInteraction(APPLICATION_ID, token, {
    embeds: [
      {
        description: `✅ Completed: **${appendSessionProgress(completed.title, completed, timesPerCycle)}**`,
        color: 0x22c55e,
      },
    ],
  });
```

Imports: `applyTaskStatusChange` from `@/lib/apply-task-status-change`, `appendSessionProgress` from `@/lib/recurring-sessions`. The existing `findFirst` + "already completed" guard above stays unchanged.

- [ ] **Step 8: Run tests and typecheck**

Run: `pnpm vitest run src/trpc/routers/task.test.ts src/lib && pnpm exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/lib/apply-task-status-change.ts src/lib/apply-task-status-change.test.ts src/trpc/routers/task.ts src/trpc/routers/task.test.ts src/app/api/discord/interactions/route.ts
git commit -m "feat(recurring): spawn and retract sessions on status change via shared executor"
```

---

### Task 4: Set cycle fields wherever recurring tasks are created

**Files:**

- Modify: `src/app/api/cron/generate-tasks/route.ts:145-158`
- Modify: `src/trpc/routers/recurringTemplate.ts:72-84` (create), `:129-150` (update with schedule change)

**Interfaces:**

- Consumes: `firstSessionFields(dueDate)` from Task 2 (its behaviour is already covered by `it("starts a cycle at session one anchored to the due date")`).

- [ ] **Step 1: Cron**

In `generate-tasks/route.ts`, inside `tx.task.create({ data: { ... } })`, add after `dueDate: taskDueDate,`:

```ts
                  ...firstSessionFields(taskDueDate),
```

Import `firstSessionFields` from `@/lib/recurring-sessions`.

- [ ] **Step 2: Template create**

In `recurringTemplate.ts` `create`, inside `tx.task.create({ data: { ... } })`, add after `dueDate: firstDueDate,`:

```ts
          ...firstSessionFields(firstDueDate),
```

`timesPerCycle` reaches `tx.recurringTemplate.create` automatically via `...input` once Task 9 adds it to the schema.

- [ ] **Step 3: Template update (schedule change)**

In `update`, change the `tx.task.updateMany` that cancels active tasks so it also detaches them from their cycle:

```ts
            data: { status: TaskStatus.CANCELLED, cycleStart: null, sessionIndex: null },
```

Then in the following `tx.task.create`, add after `dueDate: newTaskDueDate,`:

```ts
              ...firstSessionFields(newTaskDueDate),
```

Why detach: switching a schedule away from and back to the same due date would otherwise create a second `(template, cycleStart, 1)` row and violate the unique constraint. A detached cancelled task is excluded from stats anyway.

- [ ] **Step 4: Typecheck and run existing tests**

Run: `pnpm exec tsc --noEmit && pnpm vitest run`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/cron/generate-tasks/route.ts src/trpc/routers/recurringTemplate.ts
git commit -m "feat(recurring): anchor generated recurring tasks to their cycle"
```

---

### Task 5: Block snooze for multi-session templates

**Files:**

- Modify: `src/trpc/routers/task.ts:11-49` (`executeSnooze`)
- Test: `src/trpc/routers/task.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/trpc/routers/task.test.ts`:

```ts
// ─── task.snooze ──────────────────────────────────────────────────────────────

describe("task.snooze", () => {
  it("rejects snoozing a session of a multi-session template", async () => {
    const task = {
      ...createMockTask({ dueDate: new Date("2026-11-20T23:00:00Z"), recurringTemplateId: "c_template" }),
      recurringTemplate: { recurrenceType: "WEEKLY" as const, timesPerCycle: 2 },
    };
    mockDb.task.findUnique.mockResolvedValue(task);

    await expect(createCaller(makeCtx()).snooze({ taskId: task.id, days: 1 })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    } satisfies Partial<TRPCError>);
  });
});
```

Run: `pnpm vitest run src/trpc/routers/task.test.ts`
Expected: FAIL — the snooze goes ahead (or errors on an unmocked `$transaction`), so the call doesn't reject with PRECONDITION_FAILED.

- [ ] **Step 2: Implement**

In `executeSnooze`, change the include to `recurringTemplate: { select: { recurrenceType: true, timesPerCycle: true } }` and add after the daily check:

```ts
  if ((task.recurringTemplate?.timesPerCycle ?? 1) > 1) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Tasks that repeat several times per cycle cannot be snoozed",
    });
  }
```

- [ ] **Step 3: Run tests**

Run: `pnpm vitest run src/trpc/routers/task.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/trpc/routers/task.ts src/trpc/routers/task.test.ts
git commit -m "feat(recurring): block snooze for multi-session templates"
```

---

### Task 6: Cycle-aware Done column

**Files:**

- Modify: `src/lib/task-utils.ts` (`groupTasksByStatus`)
- Test: `src/lib/task-utils.test.ts`

**Interfaces:**

- Consumes: `cycleStart`/`sessionIndex` on `Task`.

- [ ] **Step 1: Write the failing tests**

In `src/lib/task-utils.test.ts`, inside `describe("groupTasksByStatus", ...)`:

```ts
  it("keeps a partly done cycle in Done while its next session is open", () => {
    const cycleStart = new Date("2024-06-14T22:00:00Z");
    const completedSession = createMockTask({
      status: TaskStatus.COMPLETED,
      recurringTemplateId: "c_template_sessions",
      cycleStart,
      sessionIndex: 1,
      createdAt: new Date("2024-06-15T07:00:00Z"),
    });
    const openSession = createMockTask({
      status: TaskStatus.PENDING,
      recurringTemplateId: "c_template_sessions",
      cycleStart,
      sessionIndex: 2,
      createdAt: new Date("2024-06-15T07:05:00Z"),
    });

    const result = groupTasksByStatus([completedSession, openSession], TZ);

    expect(result[TaskStatus.COMPLETED]).toEqual([completedSession]);
  });

  it("hides the previous cycle's completed session once a new cycle has started", () => {
    const previous = createMockTask({
      status: TaskStatus.COMPLETED,
      recurringTemplateId: "c_template_sessions",
      cycleStart: new Date("2024-06-13T22:00:00Z"),
      sessionIndex: 2,
    });
    const current = createMockTask({
      status: TaskStatus.PENDING,
      recurringTemplateId: "c_template_sessions",
      cycleStart: new Date("2024-06-14T22:00:00Z"),
      sessionIndex: 1,
    });

    const result = groupTasksByStatus([previous, current], TZ);

    expect(result[TaskStatus.COMPLETED]).toEqual([]);
  });
```

And in `describe("keepLatestTerminalPerTemplate", ...)`:

```ts
  it("keeps only the highest completed session of a cycle", () => {
    const cycleStart = new Date("2024-06-14T22:00:00Z");
    const first = createMockTask({
      status: TaskStatus.COMPLETED,
      recurringTemplateId: templateId,
      cycleStart,
      sessionIndex: 1,
      createdAt: new Date("2024-06-15T07:00:00Z"),
    });
    const second = createMockTask({
      status: TaskStatus.COMPLETED,
      recurringTemplateId: templateId,
      cycleStart,
      sessionIndex: 2,
      createdAt: new Date("2024-06-15T07:05:00Z"),
    });

    expect(keepLatestTerminalPerTemplate([first, second])).toEqual([second]);
  });
```

Run: `pnpm vitest run src/lib/task-utils.test.ts`
Expected: the first new test FAILS (the completed session is hidden because the template has an open task); the other two already PASS. They pin existing behaviour that the session model depends on.

- [ ] **Step 2: Implement**

In `groupTasksByStatus`, replace the `activeRecurringTemplateIds` block and the terminal filter loop with:

```ts
  const cycleKey = (t: Task) => `${t.recurringTemplateId}:${t.cycleStart?.getTime() ?? "none"}`;
  const activeTasks = tasks.filter(
    (t) => t.recurringTemplateId && (ACTIVE_TASK_STATUSES as readonly TaskStatus[]).includes(t.status),
  );
  const activeRecurringTemplateIds = new Set(activeTasks.map((t) => t.recurringTemplateId));
  const activeCycleKeys = new Set(activeTasks.filter((t) => t.cycleStart).map(cycleKey));

  // A finished instance is hidden once its template has moved on to a new cycle, but stays
  // visible while a later session of the *same* cycle is still open (e.g. "1/2" in Done).
  for (const status of TERMINAL_TASK_STATUSES) {
    tasksByGroup[status] = tasksByGroup[status].filter(
      (t) =>
        !t.recurringTemplateId ||
        !activeRecurringTemplateIds.has(t.recurringTemplateId) ||
        (t.cycleStart !== null && activeCycleKeys.has(cycleKey(t))),
    );
  }
```

- [ ] **Step 3: Run tests**

Run: `pnpm vitest run src/lib/task-utils.test.ts`
Expected: PASS, including every pre-existing test (single-session behaviour is unchanged because the active task is always in a later cycle).

- [ ] **Step 4: Commit**

```bash
git add src/lib/task-utils.ts src/lib/task-utils.test.ts
git commit -m "feat(recurring): keep partly done cycles visible in the Done column"
```

---

### Task 7: Optimistic session transform

**Files:**

- Modify: `src/lib/recurring-sessions.ts` (add transform)
- Test: `src/lib/recurring-sessions.test.ts`
- Modify: `src/_components/task-view/task-list.tsx:39-58`

**Interfaces:**

- Produces:

```ts
export const OPTIMISTIC_ID_PREFIX = "optimistic:";
export function isOptimisticPlaceholderId(id: string): boolean;
export type OptimisticTask = Pick<
  Task,
  "id" | "status" | "completedAt" | "createdAt" | "recurringTemplateId" | "cycleStart" | "sessionIndex"
> & { recurringTemplate?: { timesPerCycle: number } | null };
export function applyOptimisticStatusChange<T extends OptimisticTask>(
  tasks: T[],
  taskId: string,
  newStatus: TaskStatus,
  now: Date,
): T[];
```

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/recurring-sessions.test.ts` (and add `applyOptimisticStatusChange` and `isOptimisticPlaceholderId` to the import list):

```ts
describe("applyOptimisticStatusChange", () => {
  const now = new Date("2026-11-18T07:00:00Z");
  const cached = (sessionIndex: number, status: TaskStatus, id = `c_session_${sessionIndex}`) => ({
    id,
    status,
    completedAt: null,
    createdAt: new Date("2026-11-18T06:00:00Z"),
    recurringTemplateId: "c_template",
    cycleStart,
    sessionIndex,
    recurringTemplate: { timesPerCycle: 2 },
  });

  it("inserts a placeholder next session when a session below the target is completed", () => {
    const result = applyOptimisticStatusChange([cached(1, TaskStatus.PENDING)], "c_session_1", TaskStatus.COMPLETED, now);

    expect(result).toHaveLength(2);
    expect(result[1]).toMatchObject({ status: TaskStatus.PENDING, sessionIndex: 2, completedAt: null, createdAt: now });
    expect(isOptimisticPlaceholderId(result[1].id)).toBe(true);
  });

  it("stamps completedAt on the completed session", () => {
    const [completed] = applyOptimisticStatusChange(
      [cached(1, TaskStatus.PENDING)],
      "c_session_1",
      TaskStatus.COMPLETED,
      now,
    );

    expect(completed).toMatchObject({ status: TaskStatus.COMPLETED, completedAt: now });
  });

  it("removes the open next session when a completed session is reopened", () => {
    const result = applyOptimisticStatusChange(
      [cached(1, TaskStatus.COMPLETED), cached(2, TaskStatus.PENDING)],
      "c_session_1",
      TaskStatus.PENDING,
      now,
    );

    expect(result.map((t) => t.id)).toEqual(["c_session_1"]);
  });

  it("changes only the status of a task outside any cycle", () => {
    const plain = { ...cached(1, TaskStatus.PENDING), recurringTemplateId: null, cycleStart: null, sessionIndex: null };

    const result = applyOptimisticStatusChange([plain], plain.id, TaskStatus.COMPLETED, now);

    expect(result).toEqual([{ ...plain, status: TaskStatus.COMPLETED, completedAt: now }]);
  });
});
```

Run: `pnpm vitest run src/lib/recurring-sessions.test.ts`
Expected: FAIL — `applyOptimisticStatusChange` is not exported.

- [ ] **Step 2: Implement**

Append to `src/lib/recurring-sessions.ts` (add `ACTIVE_TASK_STATUSES` and `TERMINAL_TASK_STATUSES` from `@/lib/task-utils` to the imports — it is client-safe):

```ts
export const OPTIMISTIC_ID_PREFIX = "optimistic:";

export function isOptimisticPlaceholderId(id: string): boolean {
  return id.startsWith(OPTIMISTIC_ID_PREFIX);
}

export type OptimisticTask = Pick<
  Task,
  "id" | "status" | "completedAt" | "createdAt" | "recurringTemplateId" | "cycleStart" | "sessionIndex"
> & { recurringTemplate?: { timesPerCycle: number } | null };

/**
 * Client mirror of applyTaskStatusChange for the task.getAll cache. The placeholder
 * is replaced by the real row when onSettled refetches.
 */
export function applyOptimisticStatusChange<T extends OptimisticTask>(
  tasks: T[],
  taskId: string,
  newStatus: TaskStatus,
  now: Date,
): T[] {
  const target = tasks.find((t) => t.id === taskId);
  if (!target) return tasks;

  const completedAt = (TERMINAL_TASK_STATUSES as readonly TaskStatus[]).includes(newStatus) ? now : null;
  const updated = tasks.map((t) => (t.id === taskId ? { ...t, status: newStatus, completedAt } : t));

  const timesPerCycle = target.recurringTemplate?.timesPerCycle ?? 1;
  const [action] = planStatusChange(target, timesPerCycle, newStatus);
  if (!action) return updated;

  if (action.kind === "spawnNextSession") {
    const placeholder: T = {
      ...target,
      id: `${OPTIMISTIC_ID_PREFIX}${target.id}:next`,
      status: TaskStatus.PENDING,
      completedAt: null,
      createdAt: now,
      sessionIndex: action.sessionIndex,
    };
    return [...updated, placeholder];
  }

  return updated.filter(
    (t) =>
      !(
        t.recurringTemplateId === target.recurringTemplateId &&
        t.cycleStart?.getTime() === action.cycleStart.getTime() &&
        t.sessionIndex === action.sessionIndex &&
        (ACTIVE_TASK_STATUSES as readonly TaskStatus[]).includes(t.status)
      ),
  );
}
```

If importing from `@/lib/task-utils` creates a circular import later (task-utils doesn't import recurring-sessions today), keep it: there is no cycle.

- [ ] **Step 3: Run tests**

Run: `pnpm vitest run src/lib/recurring-sessions.test.ts`
Expected: PASS.

- [ ] **Step 4: Wire into `task-list.tsx`**

Replace the `setData` callback and the `completedAt` line in `onMutate`:

```ts
    onMutate: async ({ taskId, newStatus }) => {
      await trpcUtils.task.getAll.cancel({ categoryId: activeCategoryId });
      const taskCache = trpcUtils.task.getAll.getData({ categoryId: activeCategoryId });
      trpcUtils.task.getAll.setData({ categoryId: activeCategoryId }, (oldTasks) =>
        oldTasks ? applyOptimisticStatusChange(oldTasks, taskId, newStatus, new Date()) : oldTasks,
      );
      return taskCache;
    },
```

Import `applyOptimisticStatusChange` from `@/lib/recurring-sessions`; remove the now-unused `TERMINAL_TASK_STATUSES` and `TaskStatus` type imports if the linter flags them. `onError` (rollback) and `onSettled` (invalidate → swaps the placeholder for the real row) stay as they are.

- [ ] **Step 5: Typecheck, lint, commit**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: PASS. `getAll` doesn't return `timesPerCycle` until Task 8, so for now `recurringTemplate` is typed `{ recurrenceType }`. `OptimisticTask` makes `timesPerCycle` optional through `recurringTemplate?`, but if tsc rejects the structural match, do Task 8 Step 1 first.

```bash
git add src/lib/recurring-sessions.ts src/lib/recurring-sessions.test.ts src/_components/task-view/task-list.tsx
git commit -m "feat(recurring): optimistically spawn and retract sessions in the task cache"
```

---

### Task 8: Session badge in kanban, list and template history

**Files:**

- Modify: `src/trpc/routers/task.ts` (`getAll` include), `src/trpc/routers/shared-access.ts:285-288` (`getTasksForGrantor` include), `src/trpc/routers/recurringTemplate.ts` (`getHistory` select)
- Create: `src/_components/session-badge.tsx`
- Modify: `src/_components/kanban/kanban-card.tsx`, `kanban-card-content.tsx`, `kanban-card-content-readonly.tsx`, `kanban-board.tsx`, `kanban-column.tsx`, `kanban-column-readonly.tsx`, `kanban-board-readonly.tsx`
- Modify: `src/hooks/use-task-columns.tsx` (title cell)
- Modify: `src/_components/template-history.tsx`, `src/app/templates/page.tsx:47`
- Modify: `messages/en.json`, `messages/sv.json` (`TemplateHistory.session`)

**Interfaces:**

- Consumes: `getSessionProgress`, `formatSessionProgress`, `isOptimisticPlaceholderId` (Tasks 2 and 7).
- Produces: `<SessionBadge task={...} timesPerCycle={number} />`, and the type `TaskWithSessionInfo = Task & { recurringTemplate?: { timesPerCycle: number } | null }`, exported from `src/lib/types/task.ts`.

The badge is pure presentation over the already-tested `getSessionProgress`, so this task is verified by typecheck plus the manual check in Task 12 rather than new unit tests.

- [ ] **Step 1: Expose `timesPerCycle`**

- `task.ts` `getAll` include: `recurringTemplate: { select: { recurrenceType: true, timesPerCycle: true } }`.
- `shared-access.ts` `getTasksForGrantor` include: add `recurringTemplate: { select: { timesPerCycle: true } },`.
- `recurringTemplate.ts` `getHistory` select: add `sessionIndex: true,`.

In `src/lib/types/task.ts` add:

```ts
export type TaskWithSessionInfo = Task & { recurringTemplate?: { timesPerCycle: number } | null };
```

and change `TaskWithTags` to `TaskWithSessionInfo & { tags: Tag[] }`.

- [ ] **Step 2: Create the badge**

Create `src/_components/session-badge.tsx`:

```tsx
import { Badge } from "@/components/ui/badge";
import type { Task } from "@/generated/prisma/client";
import { formatSessionProgress, getSessionProgress } from "@/lib/recurring-sessions";

export const SessionBadge = ({
  task,
  timesPerCycle,
}: {
  task: Pick<Task, "status" | "sessionIndex">;
  timesPerCycle: number;
}) => {
  const progress = getSessionProgress(task, timesPerCycle);
  if (!progress) return null;

  return (
    <Badge variant={progress.isComplete ? "completed" : "in_progress"}>
      {formatSessionProgress(progress)}
      {progress.isComplete && " ✓"}
    </Badge>
  );
};
```

- [ ] **Step 3: Kanban cards**

- In `kanban-card-content.tsx` and `kanban-card-content-readonly.tsx`, change the `task` prop type from `Task` to `TaskWithSessionInfo`. Wrap the existing "Recurring" badge in a flex row and add the session badge next to it:

```tsx
        {task.recurringTemplateId && (
          <div className="flex items-center gap-x-2">
            {/* existing Recurring <Badge> unchanged */}
            <SessionBadge task={task} timesPerCycle={task.recurringTemplate?.timesPerCycle ?? 1} />
          </div>
        )}
```

- In `kanban-card-content.tsx`, make the title non-navigable for placeholders. Change the `CardTitle` `onClick` to:

```tsx
          onClick={() => !isOptimisticPlaceholderId(task.id) && router.push(`/task/${task.id}`)}
```

- In `kanban-card.tsx`, change the prop type to `TaskWithSessionInfo` and disable dragging for placeholders:

```tsx
  const isPlaceholder = isOptimisticPlaceholderId(task.id);
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: task.id,
    disabled: isPlaceholder,
  });
```

and add `isPlaceholder && "opacity-60"` to the `Card`'s `cn(...)`.

- Wherever `kanban-column*.tsx` / `kanban-board*.tsx` declare `Task[]` for these cards, widen to `TaskWithSessionInfo[]` (or `TaskWithTags[]`, which now includes it). `groupTasksByStatus` and `sortTasksForKanban` take `Task[]`; make both generic over `T extends Task` so the extra fields survive:

```ts
export const groupTasksByStatus = <T extends Task>(tasks: T[], timezone: string) => { /* body unchanged, Task[] → T[] in the Record type */ };
export const sortTasksForKanban = <T extends Task>(tasks: T[], status: TaskStatus | typeof OVERDUE_STATUS): T[] => { /* unchanged */ };
```

- [ ] **Step 4: List view**

In `src/hooks/use-task-columns.tsx`, give the `title` column a cell that renders the title plus the badge:

```tsx
        cell: ({ row }) => (
          <div className="flex items-center gap-x-2">
            <span>{row.original.title}</span>
            <SessionBadge task={row.original} timesPerCycle={row.original.recurringTemplate?.timesPerCycle ?? 1} />
          </div>
        ),
```

- [ ] **Step 5: Template history**

- `template-history.tsx`: add a `timesPerCycle: number` prop. In each row, before the status badge, render:

```tsx
              {timesPerCycle > 1 && entry.sessionIndex !== null && (
                <Badge variant="secondary">{t("session", { index: entry.sessionIndex, total: timesPerCycle })}</Badge>
              )}
```

- `src/app/templates/page.tsx:47`: pass `timesPerCycle={template.timesPerCycle}`.
- `messages/en.json` → `TemplateHistory`: `"session": "Session {index}/{total}"`. `messages/sv.json` → `TemplateHistory`: `"session": "Pass {index}/{total}"`.

- [ ] **Step 6: Typecheck, lint, test, commit**

Run: `pnpm exec tsc --noEmit && pnpm lint && pnpm vitest run`
Expected: PASS.

```bash
git add src/trpc/routers src/lib/types/task.ts src/lib/task-utils.ts src/_components src/hooks/use-task-columns.tsx src/app/templates/page.tsx messages
git commit -m "feat(recurring): show session progress badges on tasks and template history"
```

---

### Task 9: `timesPerCycle` in template schema and forms

**Files:**

- Modify: `src/lib/schemas.ts:81-117`
- Test: `src/lib/schemas.test.ts`
- Modify: `src/_components/forms/template-form-fields.tsx`, `create-template-dialog.tsx`, `update-template-form.tsx`
- Modify: `messages/en.json`, `messages/sv.json`

**Interfaces:**

- Produces: the `timesPerCycle?: number` input on `createRecurringTemplateSchema` and `updateRecurringTemplateSchema.data`; the `RecurrenceSchemaMessages.timesPerCycleInvalid` message key; and `TemplateFieldLabels.timesPerCycleLabel`.

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/schemas.test.ts`:

```ts
describe("createRecurringTemplateSchema timesPerCycle", () => {
  const base = { title: "Brush teeth", categoryId: "cxxxxxxx00000000000000001", recurrenceType: "DAILY" as const };

  it("accepts a whole number of times per cycle within the allowed range", () => {
    expect(createRecurringTemplateSchema.safeParse({ ...base, timesPerCycle: 2 }).success).toBe(true);
  });

  it("rejects zero times per cycle", () => {
    expect(createRecurringTemplateSchema.safeParse({ ...base, timesPerCycle: 0 }).success).toBe(false);
  });

  it("rejects more times per cycle than the maximum", () => {
    expect(createRecurringTemplateSchema.safeParse({ ...base, timesPerCycle: MAX_TIMES_PER_CYCLE + 1 }).success).toBe(
      false,
    );
  });

  it("rejects fractional times per cycle", () => {
    expect(createRecurringTemplateSchema.safeParse({ ...base, timesPerCycle: 1.5 }).success).toBe(false);
  });
});
```

Imports: `createRecurringTemplateSchema` from `./schemas`, `MAX_TIMES_PER_CYCLE` from `./recurring-sessions`. Check the existing file for the exact `base` fields a template needs (e.g. whether `categoryId` is required) and match them.

Run: `pnpm vitest run src/lib/schemas.test.ts`
Expected: the reject tests FAIL (unknown keys are stripped, so the parse succeeds).

- [ ] **Step 2: Implement the schema**

In `makeBaseRecurringTemplateSchema`'s `.extend({...})` add:

```ts
      timesPerCycle: z
        .int(msgs?.timesPerCycleInvalid ?? "Must be a whole number between 1 and 10")
        .min(1, msgs?.timesPerCycleInvalid ?? "Must be a whole number between 1 and 10")
        .max(MAX_TIMES_PER_CYCLE, msgs?.timesPerCycleInvalid ?? "Must be a whole number between 1 and 10")
        .optional(),
```

Add `timesPerCycleInvalid: string;` to the `RecurrenceSchemaMessages` type, and import `MAX_TIMES_PER_CYCLE`.

Run: `pnpm vitest run src/lib/schemas.test.ts`
Expected: PASS.

- [ ] **Step 3: Form field**

In `template-form-fields.tsx`, add `timesPerCycleLabel: string;` to `TemplateFieldLabels` and, after the recurrence-type field, add:

```tsx
      <Controller
        name={field("timesPerCycle")}
        control={control}
        render={({ field: f, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor={id("timesPerCycle")}>{labels.timesPerCycleLabel}</FieldLabel>
            <Input
              {...f}
              id={id("timesPerCycle")}
              type="number"
              min={1}
              max={MAX_TIMES_PER_CYCLE}
              step={1}
              value={(f.value as number | undefined) ?? 1}
              onChange={(e) => f.onChange(e.target.value === "" ? undefined : Number(e.target.value))}
              aria-invalid={fieldState.invalid}
            />
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />
```

Match the surrounding fields' exact `Field`/`FieldError` usage in this file if it differs from the above.

- [ ] **Step 4: Wire the dialogs**

- `create-template-dialog.tsx`: add `timesPerCycle: 1` to `getDefaultValues`, `timesPerCycleInvalid: tSchemas("timesPerCycleInvalid")` to the schema messages, and `timesPerCycleLabel: t("timesPerCycleLabel")` to `labels`.
- `update-template-form.tsx`: add `timesPerCycle: template.timesPerCycle` to `defaultValues.data`, plus the same message and label entries.

- [ ] **Step 5: Messages**

- `messages/en.json`: `CreateTemplateDialog.timesPerCycleLabel` and `UpdateTemplateForm.timesPerCycleLabel` = `"Times per cycle"`; `Schemas.timesPerCycleInvalid` = `"Must be a whole number between 1 and 10"`.
- `messages/sv.json`: `"Gånger per cykel"` and `"Måste vara ett heltal mellan 1 och 10"`.

- [ ] **Step 6: Typecheck, lint, commit**

Run: `pnpm exec tsc --noEmit && pnpm lint && pnpm vitest run`
Expected: PASS.

```bash
git add src/lib/schemas.ts src/lib/schemas.test.ts src/_components/forms messages
git commit -m "feat(recurring): let templates require several completions per cycle"
```

---

### Task 10: Group sessions into cycles for recurring-status

**Files:**

- Create: `src/lib/recurring-cycles.ts`
- Test: `src/lib/recurring-cycles.test.ts`
- Modify: `src/app/api/automations/recurring-status/route.ts`
- Test: `src/app/api/automations/recurring-status/route.test.ts`

**Interfaces:**

- Produces:

```ts
export type CycleTaskEntry = { status: TaskStatus; cycleStart?: Date | null };
export function groupIntoCycles(tasksNewestFirst: CycleTaskEntry[], timesPerCycle: number): { status: TaskStatus }[];
```

Outcome per cycle: COMPLETED if completed sessions ≥ `timesPerCycle`; CANCELLED if every session is cancelled; otherwise the latest session's status if it's active (PENDING/IN_PROGRESS/BLOCKED); otherwise SKIPPED. For single-session cycles this returns exactly the task's own status, so existing streak behaviour is unchanged. Tasks without `cycleStart` (legacy or detached) are each their own cycle.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/recurring-cycles.test.ts`:

```ts
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

  it("excludes a cycle whose sessions were all cancelled", () => {
    expect(groupIntoCycles([entry(TaskStatus.CANCELLED, day1)], 2)).toEqual([{ status: TaskStatus.CANCELLED }]);
  });

  it("leaves a partly done newest cycle pending so the streak is not broken yet", () => {
    const history = [entry(TaskStatus.PENDING, day2), entry(TaskStatus.COMPLETED, day2), entry(TaskStatus.COMPLETED, day1)];
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
```

Run: `pnpm vitest run src/lib/recurring-cycles.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 2: Implement**

Create `src/lib/recurring-cycles.ts`:

```ts
import { TaskStatus } from "@/generated/prisma/enums";
import { ACTIVE_TASK_STATUSES } from "@/lib/task-utils";

export type CycleTaskEntry = { status: TaskStatus; cycleStart?: Date | null };

/**
 * Collapses sessions (newest first) into one entry per cycle, so streak and
 * percentage math keeps treating "one entry = one cycle".
 */
export function groupIntoCycles(tasksNewestFirst: CycleTaskEntry[], timesPerCycle: number): { status: TaskStatus }[] {
  const cycles: CycleTaskEntry[][] = [];
  const indexByKey = new Map<number, number>();

  for (const task of tasksNewestFirst) {
    const key = task.cycleStart?.getTime();
    if (key === undefined) {
      cycles.push([task]);
      continue;
    }
    const existing = indexByKey.get(key);
    if (existing === undefined) {
      indexByKey.set(key, cycles.length);
      cycles.push([task]);
    } else {
      cycles[existing].push(task);
    }
  }

  return cycles.map((sessions) => ({ status: cycleOutcome(sessions, timesPerCycle) }));
}

function cycleOutcome(sessionsNewestFirst: CycleTaskEntry[], timesPerCycle: number): TaskStatus {
  const completed = sessionsNewestFirst.filter((s) => s.status === TaskStatus.COMPLETED).length;
  if (completed >= timesPerCycle) return TaskStatus.COMPLETED;
  if (sessionsNewestFirst.every((s) => s.status === TaskStatus.CANCELLED)) return TaskStatus.CANCELLED;

  const latest = sessionsNewestFirst[0].status;
  return (ACTIVE_TASK_STATUSES as readonly TaskStatus[]).includes(latest) ? latest : TaskStatus.SKIPPED;
}
```

Run: `pnpm vitest run src/lib/recurring-cycles.test.ts`
Expected: PASS.

- [ ] **Step 3: Write the failing route test**

Append inside the route's `describe` in `recurring-status/route.test.ts`:

```ts
  it("reports a multi-session habit as not done this cycle until every session is completed", async () => {
    const today = new Date("2026-11-17T23:00:00Z");
    mockDb.recurringTemplate.findMany.mockResolvedValue([
      {
        id: "c_teeth",
        title: "Brush teeth",
        recurrenceType: RecurrenceType.DAILY,
        timesPerCycle: 2,
        tasks: [
          { status: TaskStatus.PENDING, cycleStart: today },
          { status: TaskStatus.COMPLETED, cycleStart: today },
        ],
      },
    ] as never);

    const res = await GET(makeRequest());
    const [teeth] = (await res.json()) as { completedThisCycle: boolean }[];

    expect(teeth.completedThisCycle).toBe(false);
  });
```

Run: `pnpm vitest run src/app/api/automations/recurring-status/route.test.ts`
Expected: this test may already pass by accident (`tasks[0]` is PENDING). Add a second test that fails today:

```ts
  it("counts a fully completed multi-session cycle once in the streak", async () => {
    const day1 = new Date("2026-11-16T23:00:00Z");
    mockDb.recurringTemplate.findMany.mockResolvedValue([
      {
        id: "c_teeth",
        title: "Brush teeth",
        recurrenceType: RecurrenceType.DAILY,
        timesPerCycle: 2,
        tasks: [
          { status: TaskStatus.COMPLETED, cycleStart: day1 },
          { status: TaskStatus.COMPLETED, cycleStart: day1 },
        ],
      },
    ] as never);

    const res = await GET(makeRequest());
    const [teeth] = (await res.json()) as { currentStreak: number }[];

    expect(teeth.currentStreak).toBe(1);
  });
```

Expected: FAIL — the current code counts 2.

- [ ] **Step 4: Implement in the route**

In `route.ts`:

- Import `groupIntoCycles` and `MAX_TIMES_PER_CYCLE`.
- In the `findMany` select, add `timesPerCycle: true`. Change `tasks` to:

```ts
      tasks: {
        select: { status: true, cycleStart: true },
        // nulls last: detached (cycle-less) cancelled tasks must not push real cycles out of the window
        orderBy: [{ cycleStart: { sort: "desc", nulls: "last" } }, { sessionIndex: "desc" }],
        take: HISTORY_LOOKBACK * MAX_TIMES_PER_CYCLE,
      },
```

- Replace the `response` mapping with:

```ts
  const response = templates.map((template) => {
    const cycles = groupIntoCycles(template.tasks, template.timesPerCycle).slice(0, HISTORY_LOOKBACK);
    return {
      id: template.id,
      title: template.title,
      recurrenceType: template.recurrenceType,
      completedThisCycle: cycles[0]?.status === TaskStatus.COMPLETED,
      currentStreak: computeStreak(cycles),
      completionPercentage: computeCompletionPercentage(cycles),
    };
  });
```

- Update the `computeStreak` doc comment: "Each entry is one cycle (sessions are collapsed by `groupIntoCycles`)…".

Pre-existing tests pass fixtures without `timesPerCycle`/`cycleStart`. `groupIntoCycles(tasks, undefined)` would treat `completed >= undefined` as false, so make the call `groupIntoCycles(template.tasks, template.timesPerCycle ?? 1)` to stay safe with old fixtures.

The orderBy changes from `dueDate desc` to `cycleStart desc`. Postgres sorts NULLs first under `DESC` by default, which is why the code above uses `nulls: "last"`.

- [ ] **Step 5: Run tests**

Run: `pnpm vitest run src/app/api/automations/recurring-status src/lib/recurring-cycles.test.ts`
Expected: PASS, including all pre-existing route tests.

- [ ] **Step 6: Commit**

```bash
git add src/lib/recurring-cycles.ts src/lib/recurring-cycles.test.ts src/app/api/automations/recurring-status
git commit -m "feat(recurring): compute recurring-status streaks per cycle instead of per task"
```

---

### Task 11: Daily digest suffix and CLI support

**Files:**

- Modify: `src/app/api/cron/daily-digest/route.ts:22-55`
- Modify: `scripts/momentum-cli.ts`

**Interfaces:**

- Consumes: `appendSessionProgress` (Task 2; covered by its tests).

- [ ] **Step 1: Digest**

In `daily-digest/route.ts`, change the include to `recurringTemplate: { select: { recurrenceType: true, timesPerCycle: true } }`. At the top of the per-user callback, before `dailyRecurring`, add:

```ts
        const tasks = user.tasks.map((t) => ({
          ...t,
          title: appendSessionProgress(t.title, t, t.recurringTemplate?.timesPerCycle ?? 1),
        }));
```

Then use `tasks` instead of `user.tasks` in the `dailyRecurring` and `otherTasks` filters. The email and the Discord embeds both read `title`, so both pick up the suffix.

- [ ] **Step 2: CLI**

In `scripts/momentum-cli.ts`:

- `tasks`: print the suffix:

```ts
        const title = appendSessionProgress(t.title, t, t.recurringTemplate?.timesPerCycle ?? 1);
        console.log(`${t.id}  [${t.status}]  ${title}  due:${t.dueDate?.toISOString().slice(0, 10) ?? "-"}`);
```

- `templates`: append `x${t.timesPerCycle}` when it's greater than 1:

```ts
        const timesSuffix = t.timesPerCycle > 1 ? `  x${t.timesPerCycle}/cycle` : "";
        console.log(`${t.id}  ${t.title}  (${t.recurrenceType})${timesSuffix}${pausedSuffix}`);
```

- `template:create` and `template:update`: pass `timesPerCycle: flags.times ? Number(flags.times) : undefined`.
- Usage text: add `[--times N]` to the `template:create` and `template:update` lines.

- [ ] **Step 3: Typecheck, smoke-test the CLI help, commit**

Run: `pnpm exec tsc --noEmit && pnpm momentum`
Expected: tsc PASS; the usage output shows `--times N`. (`pnpm momentum` with no args needs `ADMIN_CLERK_USER_ID` and a DB connection, because it builds context first. If it can't connect, rely on tsc.)

```bash
git add src/app/api/cron/daily-digest/route.ts scripts/momentum-cli.ts
git commit -m "feat(recurring): show session progress in the daily digest and CLI"
```

---

### Task 12: Spec sync, database rollout, end-to-end check

**Files:**

- Modify: `docs/superpowers/specs/2026-11-17-multi-session-recurring-tasks-design.md`
- Modify: `.claude/CLAUDE.md`

- [ ] **Step 1: Apply the spec deltas**

Edit the spec so it matches what was built — one edit per item in this plan's "Spec deltas" list:

- "Done column collapse" — the `groupTasksByStatus` same-cycle rule.
- Rule 1 — `createMany({ skipDuplicates: true })` instead of catching `P2002`, with the reason.
- "Cron" — add `recurringTemplate.create`/`update` and the detaching of cancelled tasks.
- "`recurring-status` route" — the single query with `take: HISTORY_LOOKBACK * MAX_TIMES_PER_CYCLE` and nulls-last ordering.
- "Optimistic updates" — `onSettled` already invalidates.
- "Backfill" — push first, then backfill.

- [ ] **Step 2: Document the invariant in project CLAUDE.md**

Under a new `## Recurring sessions` heading in `.claude/CLAUDE.md`:

```markdown
## Recurring sessions

- Every task status change must go through `applyTaskStatusChange` (`src/lib/apply-task-status-change.ts`) so multi-session templates spawn/retract sessions. The HA endpoint `/api/automations/complete-recurring-task` is the one known exception — route it through the executor before driving any multi-session template from Home Assistant.
- At most one session per cycle is open at a time; `@@unique([recurringTemplateId, cycleStart, sessionIndex])` enforces no duplicates.
```

- [ ] **Step 3: Full verification**

Run: `pnpm exec tsc --noEmit && pnpm lint && pnpm vitest run`
Expected: all PASS. Paste the summary line.

- [ ] **Step 4: Database rollout — ASK THE USER FIRST**

This writes to the production Prisma Postgres database. Confirm with the user before each command:

1. `pnpm prisma db push` — adds the columns and the unique index. Every existing row has NULL `cycleStart`/`sessionIndex`, so no conflicts are possible.
2. `pnpm tsx scripts/backfill-recurring-cycles.ts --dry-run` — reports collisions and the row count. If there are collisions, stop and show them to the user.
3. `pnpm tsx scripts/backfill-recurring-cycles.ts` — writes the cycle fields.

- [ ] **Step 5: Manual end-to-end check (dev server)**

With the user, via the `run` skill or `pnpm dev`:

1. Create a daily template "Brush teeth" with times per cycle = 2. Expect a "0/2" card in To Do.
2. Drag it to Done. Expect a "1/2" (amber) card in Done and a placeholder "1/2" card in To Do that becomes interactive after the refetch.
3. Drag the new session to Done. Expect a single "2/2 ✓" (green) card in Done and nothing in To Do.
4. Drag the Done card back to To Do. Expect "1/2" in To Do, and Done shows the session 1 card.
5. `/complete` the open session in Discord. The reply shows "(2/2)".
6. Try snoozing a session from the list view. Expect an error toast.
7. Check `pnpm momentum tasks` and `pnpm momentum templates` output.

- [ ] **Step 6: Commit**

```bash
git add docs/superpowers/specs/2026-11-17-multi-session-recurring-tasks-design.md .claude/CLAUDE.md
git commit -m "docs: sync multi-session spec with implementation and record session invariant"
```

---

## Future work (not in this plan)

- Route the HA endpoint through `applyTaskStatusChange`.
- Expandable Done card listing each session's completion time.
- Per-cycle session counts in the `recurring-status` response and the Nucleus widget.
- Snooze for multi-session weekly/monthly templates.
