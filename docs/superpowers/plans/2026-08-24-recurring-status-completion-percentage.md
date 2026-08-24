# Recurring Status Completion Percentage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a trailing completion percentage to each recurring habit alongside its existing streak, in both Momentum's `recurring-status` API and Nucleus's dashboard "Recurring" widget.

**Architecture:** Momentum's `GET /api/automations/recurring-status` route already fetches each template's last 30 task instances (newest first) to compute `currentStreak`. A new sibling function, `computeCompletionPercentage`, reuses that same array with no new query, and its result is added to the route's JSON response. Nucleus's `momentum.ts` service type is extended to match, and the dashboard widget renders the new field next to the streak.

**Tech Stack:** Next.js/TypeScript/Prisma (Momentum), Next.js/TypeScript/tRPC (Nucleus), Vitest for both.

## Global Constraints

- Percentage is computed over the same `HISTORY_LOOKBACK = 30` window already used for the streak — no new query, no new constant.
- `CANCELLED` cycles are excluded from the denominator entirely (never counted).
- `SKIPPED` (and any other non-`COMPLETED`, non-`CANCELLED` status) counts as a miss.
- The newest cycle, if `PENDING`, is excluded from both numerator and denominator — same forgiving exclusion `computeStreak` already applies.
- Return `null` (never `0`) when zero cycles remain to count — a brand-new template shouldn't render as "0%".
- Nucleus's `MomentumRecurringStatus` type must mirror Momentum's response exactly (existing convention, per the 2026-08-22 recurring-status widget design doc).
- Percentage renders in the dashboard widget only when non-null (mirrors the streak's existing `> 0` display guard).

---

### Task 1: `computeCompletionPercentage` in Momentum's `recurring-status` route

**Files:**

- Modify: `/home/psteingruber/momentum/src/app/api/automations/recurring-status/route.ts`
- Test: `/home/psteingruber/momentum/src/app/api/automations/recurring-status/route.test.ts`

**Interfaces:**

- Consumes: existing `HistoryEntry` type (`{ status: TaskStatus }`, line 29 of `route.ts`), existing `TaskStatus` enum (`PENDING`, `IN_PROGRESS`, `BLOCKED`, `COMPLETED`, `CANCELLED`, `SKIPPED`), existing `template("t1", "Dishwasher", RecurrenceType.DAILY, [...])` test helper (`route.test.ts:22-27`).
- Produces: `computeCompletionPercentage(historyNewestFirst: HistoryEntry[]): number | null`, and the route's JSON response gains a `completionPercentage: number | null` field on every item.

- [ ] **Step 1: Write the failing tests**

Add these `it` blocks inside the existing `describe("GET /api/automations/recurring-status", ...)` block in `route.test.ts`, placed directly after the existing `"returns a zero streak when the newest resolved instance is cancelled"` test (after line 148):

```typescript
  it("reports 100% completion when every counted cycle is completed", async () => {
    mockDb.recurringTemplate.findMany.mockResolvedValue([
      template("t1", "Dishwasher", RecurrenceType.DAILY, [
        { status: TaskStatus.COMPLETED },
        { status: TaskStatus.COMPLETED },
        { status: TaskStatus.COMPLETED },
      ]),
    ] as never);
    const res = await GET(makeRequest());
    const json = (await res.json()) as { completionPercentage: number | null }[];
    expect(json[0].completionPercentage).toBe(100);
  });

  it("counts a skipped cycle as a miss against the percentage", async () => {
    mockDb.recurringTemplate.findMany.mockResolvedValue([
      template("t1", "Dishwasher", RecurrenceType.DAILY, [
        { status: TaskStatus.COMPLETED },
        { status: TaskStatus.COMPLETED },
        { status: TaskStatus.SKIPPED },
        { status: TaskStatus.COMPLETED },
      ]),
    ] as never);
    const res = await GET(makeRequest());
    const json = (await res.json()) as { completionPercentage: number | null }[];
    expect(json[0].completionPercentage).toBe(75);
  });

  it("excludes a cancelled cycle from the percentage's denominator", async () => {
    mockDb.recurringTemplate.findMany.mockResolvedValue([
      template("t1", "Dishwasher", RecurrenceType.DAILY, [
        { status: TaskStatus.COMPLETED },
        { status: TaskStatus.CANCELLED },
        { status: TaskStatus.COMPLETED },
      ]),
    ] as never);
    const res = await GET(makeRequest());
    const json = (await res.json()) as { completionPercentage: number | null }[];
    expect(json[0].completionPercentage).toBe(100);
  });

  it("excludes a still-pending newest cycle from the percentage, same as the streak's forgiving rule", async () => {
    mockDb.recurringTemplate.findMany.mockResolvedValue([
      template("t1", "Dishwasher", RecurrenceType.DAILY, [
        { status: TaskStatus.PENDING },
        { status: TaskStatus.COMPLETED },
        { status: TaskStatus.SKIPPED },
      ]),
    ] as never);
    const res = await GET(makeRequest());
    const json = (await res.json()) as { completionPercentage: number | null }[];
    expect(json[0].completionPercentage).toBe(50);
  });

  it("returns null completion percentage when no resolved history exists yet", async () => {
    mockDb.recurringTemplate.findMany.mockResolvedValue([
      template("t1", "Dishwasher", RecurrenceType.DAILY, [{ status: TaskStatus.PENDING }]),
    ] as never);
    const res = await GET(makeRequest());
    const json = (await res.json()) as { completionPercentage: number | null }[];
    expect(json[0].completionPercentage).toBeNull();
  });
```

Also update the existing exact-shape test (`"returns id, title, and recurrenceType alongside the computed fields"`, currently lines 150-165) so its `toEqual` includes the new field — replace:

```typescript
      {
        id: "t1",
        title: "Take Medicine",
        recurrenceType: RecurrenceType.WEEKLY,
        completedThisCycle: true,
        currentStreak: 1,
      },
```

with:

```typescript
      {
        id: "t1",
        title: "Take Medicine",
        recurrenceType: RecurrenceType.WEEKLY,
        completedThisCycle: true,
        currentStreak: 1,
        completionPercentage: 100,
      },
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `cd /home/psteingruber/momentum && pnpm test -- recurring-status`
Expected: the 5 new tests FAIL (`completionPercentage` is `undefined`, not the expected number/null), and the updated exact-shape test FAILS on the missing `completionPercentage` key. All other existing tests in the file still PASS.

- [ ] **Step 3: Implement `computeCompletionPercentage` and wire it into the response**

In `route.ts`, add the new function directly after `computeStreak` (after line 55, before `export async function GET`):

```typescript
/**
 * Trailing completion rate over the same history window computeStreak
 * uses. CANCELLED cycles are excluded from the denominator entirely (the
 * cycle never should have existed); SKIPPED and any other non-COMPLETED,
 * non-CANCELLED status counts as a miss. The newest cycle, if still
 * PENDING, is excluded from both numerator and denominator — same
 * forgiving exclusion as computeStreak, kept consistent across both
 * calculations. Returns null (not 0) when nothing is left to count, so a
 * brand-new template doesn't render as "0%".
 */
function computeCompletionPercentage(historyNewestFirst: HistoryEntry[]): number | null {
  let startIndex = 0;
  if (historyNewestFirst[0]?.status === TaskStatus.PENDING) {
    startIndex = 1;
  }

  let completed = 0;
  let counted = 0;
  for (let i = startIndex; i < historyNewestFirst.length; i++) {
    const status = historyNewestFirst[i].status;
    if (status === TaskStatus.CANCELLED) continue;
    counted += 1;
    if (status === TaskStatus.COMPLETED) completed += 1;
  }
  return counted === 0 ? null : Math.round((completed / counted) * 100);
}
```

Then update the `response` map (currently lines 95-101) to include the new field:

```typescript
  const response = templates.map((template) => ({
    id: template.id,
    title: template.title,
    recurrenceType: template.recurrenceType,
    completedThisCycle: template.tasks[0]?.status === TaskStatus.COMPLETED,
    currentStreak: computeStreak(template.tasks),
    completionPercentage: computeCompletionPercentage(template.tasks),
  }));
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /home/psteingruber/momentum && pnpm test -- recurring-status`
Expected: all tests in `route.test.ts` PASS, including the 5 new ones and the updated exact-shape test.

- [ ] **Step 5: Typecheck**

Run: `cd /home/psteingruber/momentum && pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
cd /home/psteingruber/momentum
git add src/app/api/automations/recurring-status/route.ts src/app/api/automations/recurring-status/route.test.ts
git commit -m "feat: add trailing completion percentage to recurring-status route

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SeGS1fLQszMDj3rdK4ZxLc"
```

---

### Task 2: Consume `completionPercentage` in Nucleus's Momentum service type

**Files:**

- Modify: `/opt/nucleus-app/src/lib/services/momentum.ts:1-7`

**Interfaces:**

- Consumes: Momentum's `GET /api/automations/recurring-status` response, now including `completionPercentage: number | null` (Task 1).
- Produces: `MomentumRecurringStatus.completionPercentage: number | null`, consumed by Task 3's widget render.

No test file exists for `momentum.ts` (a thin type + fetch wrapper, matching this repo's existing no-test convention for this file — confirmed by the file's current test-free state).

- [ ] **Step 1: Add the field to the type**

In `/opt/nucleus-app/src/lib/services/momentum.ts`, change:

```typescript
export type MomentumRecurringStatus = {
  id: string;
  title: string;
  recurrenceType: "DAILY" | "WEEKLY";
  completedThisCycle: boolean;
  currentStreak: number;
};
```

to:

```typescript
export type MomentumRecurringStatus = {
  id: string;
  title: string;
  recurrenceType: "DAILY" | "WEEKLY";
  completedThisCycle: boolean;
  currentStreak: number;
  completionPercentage: number | null;
};
```

No other change to this file — `getMomentumRecurringStatus` already returns Momentum's JSON response as-is (line 26: `const statuses: MomentumRecurringStatus[] = await res.json();`), so the new field flows through automatically once the type declares it.

- [ ] **Step 2: Typecheck**

Run: `cd /opt/nucleus-app && pnpm typecheck`
Expected: no errors (this step alone can't fail — it's a type widening — but confirms nothing downstream broke before Task 3 touches the consumer).

- [ ] **Step 3: Commit**

```bash
cd /opt/nucleus-app
git add src/lib/services/momentum.ts
git commit -m "feat: add completionPercentage to MomentumRecurringStatus type

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SeGS1fLQszMDj3rdK4ZxLc"
```

---

### Task 3: Render the percentage in the dashboard's Recurring widget

**Files:**

- Modify: `/opt/nucleus-app/src/app/(app)/page.tsx:196-200`

**Interfaces:**

- Consumes: `status.completionPercentage: number | null` from `MomentumRecurringStatus` (Task 2).
- Produces: no new exports — this is a leaf UI change with no downstream consumer.

No component test — matches `MomentumWidget`'s existing established convention (no test exists for this widget today; the 2026-08-22 recurring-status widget design doc explicitly notes this class of thin fetch+render widget has none).

- [ ] **Step 1: Add the percentage next to the streak**

In `/opt/nucleus-app/src/app/(app)/page.tsx`, inside `MomentumWidget`'s per-status `<span className="flex items-center gap-2 text-muted-foreground">` block, currently:

```tsx
                <span className="flex items-center gap-2 text-muted-foreground">
                  {status.currentStreak > 0 && (
                    <span className="flex items-center gap-1">
                      🔥 <span className="inline-block min-w-[1.5ch] text-right tabular-nums">{status.currentStreak}</span>
                    </span>
                  )}
                  {status.completedThisCycle ? (
```

change to:

```tsx
                <span className="flex items-center gap-2 text-muted-foreground">
                  {status.currentStreak > 0 && (
                    <span className="flex items-center gap-1">
                      🔥 <span className="inline-block min-w-[1.5ch] text-right tabular-nums">{status.currentStreak}</span>
                    </span>
                  )}
                  {status.completionPercentage !== null && (
                    <span className="text-xs tabular-nums">{status.completionPercentage}%</span>
                  )}
                  {status.completedThisCycle ? (
```

This mirrors the streak's own display guard (`> 0`) with the equivalent guard for this field (`!== null`), and uses `text-xs` to keep it visually secondary to the streak/checkmark, consistent with the "Weekly" badge's own `text-xs` sizing a few lines above in the same component.

- [ ] **Step 2: Typecheck**

Run: `cd /opt/nucleus-app && pnpm typecheck`
Expected: no errors.

- [ ] **Step 3: Build**

Run: `cd /opt/nucleus-app && pnpm build`
Expected: build succeeds (this repo's Dockerfile gates on `pnpm test` at build time per the nucleus KB's established deploy pattern — running the full build locally here catches the same class of issue before a real deploy).

- [ ] **Step 4: Commit**

```bash
cd /opt/nucleus-app
git add "src/app/(app)/page.tsx"
git commit -m "feat: show trailing completion percentage on Recurring widget

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SeGS1fLQszMDj3rdK4ZxLc"
```

---

### Task 4: Deploy and verify live

**Files:** none (deployment + KB documentation only)

**Interfaces:**

- Consumes: Tasks 1-3's committed changes in both repos.
- Produces: a KB entry in `/opt/docker/docs/kb/nucleus.md`'s Known Issues log, per that file's "write to it proactively" convention.

- [ ] **Step 1: Deploy Momentum**

Momentum runs outside this homelab's Docker stack (its own hosting — confirm current deployment mechanism with the user before this step if unclear; do not guess at a deploy command). Deploy the Task 1 change so the live `recurring-status` endpoint returns `completionPercentage`.

- [ ] **Step 2: Rebuild and redeploy Nucleus**

Run: `cd /opt/docker && docker compose -f nucleus/docker-compose.yml up -d --build nucleus`
Expected: container comes up healthy (`docker inspect nucleus` shows `"Health": {"Status": "healthy"}`), `docker logs nucleus` shows no new errors.

- [ ] **Step 3: Verify live**

Check the deployed dashboard (or `docker exec nucleus grep -rl "completionPercentage" /app/.next` to confirm the field reached the built client bundle) against at least one real recurring habit with resolved history, confirming a percentage renders next to its streak.

- [ ] **Step 4: Document in the Nucleus KB**

Add a dated entry to `/opt/docker/docs/kb/nucleus.md`'s `## Known Issues / Troubleshooting Log` (inserted at the top of the section, above the existing 2026-08-24 note-deletion entry, per that file's newest-first convention), summarizing: the trailing-completion-percentage addition to Momentum's `recurring-status` route and the Nucleus widget, the SKIPPED-counts/CANCELLED-excluded/PENDING-forgiving-exclusion rules, and the live verification result from Step 3.

- [ ] **Step 5: Commit the KB update**

```bash
cd /opt/docker
git add docs/kb/nucleus.md
git commit -m "docs(nucleus): log Recurring widget completion-percentage addition

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SeGS1fLQszMDj3rdK4ZxLc"
```
