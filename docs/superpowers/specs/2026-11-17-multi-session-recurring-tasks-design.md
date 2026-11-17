# Multi-session recurring tasks — Design

## Problem

Some habits must be done more than once per cycle — brushing teeth twice a
day, stretching three times a week. Today a `RecurringTemplate` produces
exactly one `Task` per cycle and "done" is a single status transition, so
there's no way to express or track "2 of 2 done today".

## Model: one Task row per session

A cycle with target N is completed through up to N sequential **sessions**,
each a regular `Task` row. Completing session k (k < N) spawns session k+1
as a new PENDING task. This keeps the existing invariant "one Task row = one
completion", gives every completion its own `completedAt`, and keeps
"one open instance per template" true at all times (only one session of a
cycle is ever open).

Semantics are count-only: sessions have no time slots and no per-session
reminders beyond the template's existing `reminderTime`.

## Schema (applied with `prisma db push`)

```prisma
model RecurringTemplate {
  // ...existing fields
  timesPerCycle Int @default(1)
}

model Task {
  // ...existing fields
  cycleStart   DateTime?
  sessionIndex Int?

  @@unique([recurringTemplateId, cycleStart, sessionIndex])
}
```

- A **cycle** is identified by `(recurringTemplateId, cycleStart)`.
  `cycleStart` is set to the cycle's due date when the cron creates session 1
  and never changes afterwards — editing or snoozing `dueDate` does not move a
  session to another cycle.
- `sessionIndex` is 1-based. Session k+1 exists only if session k was
  completed, so the highest completed `sessionIndex` in a cycle equals the
  cycle's completed count.
- Postgres treats NULLs as distinct, so non-recurring tasks (NULL
  `cycleStart`/`sessionIndex`) never collide on the unique constraint.
- The unique constraint is the race guard: a second "spawn session k+1" from
  a double-click or concurrent Discord/web completion fails with `P2002`.
- Changing `timesPerCycle` on a template takes effect on the next spawn or
  next cycle. A cycle already at 2/2 does not reopen if the target is raised
  to 3; it displays 2/3 until it ends. No per-task target snapshot.

### Backfill

One-off script, run before the `db push` that adds the unique constraint:

1. Query for existing collisions: tasks with the same
   `(recurringTemplateId, dueDate)`. Report them and abort if any exist
   (commit `34327b5` dealt with duplicate recurring instances, so this is a
   real risk). Resolve manually before continuing.
2. For every task with a `recurringTemplateId`: `cycleStart = dueDate`,
   `sessionIndex = 1`.

## Cycle outcome

Used by stats (see `recurring-status` below):

| Cycle state | Outcome |
| --- | --- |
| completed sessions ≥ `timesPerCycle` | COMPLETED |
| every session CANCELLED | CANCELLED (excluded from stats) |
| newest cycle, an open session remains | PENDING (forgiven, as today) |
| anything else (e.g. 1/2 at cycle end) | SKIPPED (miss) |

There is no partial credit and no new `TaskStatus` value.

## Server: shared status-change logic

New module `src/lib/recurring-sessions.ts`:

- `planStatusChange(task, template, newStatus)` — **pure**, returns a list of
  actions (`spawnNextSession`, `deleteOpenNextSession`, or none).
- `applyTaskStatusChange(tx, task, newStatus)` — thin executor: updates the
  task's status/`completedAt` (same rules as today's `updateStatus`) and
  performs the planned actions inside the caller's transaction.

Rules:

1. **→ COMPLETED, `sessionIndex < timesPerCycle`:** create session k+1:
   PENDING, title/description/categoryId/reminderTime copied from the
   template, same `cycleStart`, same `dueDate`, `sessionIndex = k + 1`. A
   `P2002` on this insert means it already exists — treat as success.
2. **COMPLETED → non-terminal status** (dragged out of Done): delete the
   cycle's open (non-terminal) session k+1 if it exists. The collapsed Done
   card represents the highest completed session, so un-completing reverses
   exactly one step.
3. **→ SKIPPED or CANCELLED:** no spawn; the cycle ends.
4. **`timesPerCycle = 1`:** rule 1 never applies; behaviour is identical to
   today.

Callers:

- `task.updateStatus` (tRPC) — wraps the call in `ctx.db.$transaction`. The
  Momentum CLI goes through this router and needs no separate change for
  completion.
- Discord `/complete` (`src/app/api/discord/interactions/route.ts`) —
  replaces its inline `prisma.task.update` with the shared function; the reply
  appends the badge, e.g. "✅ Completed: **Brush teeth** (1/2)".
- HA endpoint `POST /api/automations/complete-recurring-task` — **unchanged**
  in this version (see Future work).

### Snooze

The shared snooze helper in `src/trpc/routers/task.ts` (used by both
`task.snooze` and `task.snoozeToNextMonday`) already rejects daily recurring
tasks. It additionally rejects any task whose template has
`timesPerCycle > 1`, with the same `PRECONDITION_FAILED` error; its
`recurringTemplate` select gains `timesPerCycle`. Snooze shifts the template schedule, which is
ill-defined mid-cycle.

### Cron (`generate-tasks`)

- The "one active task per template" lookup still holds — only one session
  per cycle is open.
- At cycle end the open session is marked SKIPPED, as today.
- New tasks are created with `cycleStart = taskDueDate`, `sessionIndex = 1`.

## Web UI

### Badge

Shown only when `timesPerCycle > 1`. `task.getAll` (and the shared-access
equivalent) include `recurringTemplate.timesPerCycle`.

- **Done card:** `sessionIndex/timesPerCycle`. Complete style (green tone,
  ✓) when equal to target, partial style (amber tone) otherwise. ShadCN
  `Badge`.
- **Open card:** `(sessionIndex − 1)/timesPerCycle` — progress so far
  (fresh cycle shows 0/2; the pending session 2 shows 1/2).
- Same badge in the list view and the read-only kanban.

### Done column collapse

Already provided by `keepLatestTerminalPerTemplate` (`src/lib/task-utils.ts`),
which keeps the newest terminal instance per template by `createdAt`. Session
k+1 is always created after session k, so the newest terminal row is the
highest completed session. No change needed beyond verifying with a test.

### Optimistic updates (`src/_components/task-view/task-list.tsx`)

Extract the cache transform into a pure function
`applyOptimisticStatusChange(tasks, taskId, newStatus)`:

- **→ COMPLETED, `sessionIndex < timesPerCycle`:** mark completed and stamp
  `completedAt` (as today), and insert a placeholder session k+1 with id
  `optimistic:<taskId>:next`, PENDING, `sessionIndex + 1`. The placeholder
  renders but is not draggable or clickable until replaced.
- **COMPLETED → non-terminal for a multi-session task:** remove the cycle's
  open session k+1 from the cache.
- In both cases `onSettled` invalidates `task.getAll` so the placeholder is
  swapped for the real row. Other status changes keep the current
  no-invalidation behaviour from `34327b5`.
- On error the existing snapshot rollback restores the cache, including
  removing the placeholder.

### Template forms

`create-template-dialog.tsx` and `update-template-form.tsx` gain a
"Times per cycle" ShadCN `Input type="number"` (integer, min 1, max 10,
default 1). Validation in `src/lib/schemas.ts`; labels via next-intl
`messages/`.

### Template history

`template-history.tsx` renders the session badge on each row. No grouping by
cycle in this version.

## `recurring-status` route

- New pure function `groupIntoCycles(tasks, timesPerCycle)` reduces sessions
  to one `HistoryEntry` per cycle using the outcome table above.
- `computeStreak` and `computeCompletionPercentage` run unchanged on the
  per-cycle entries.
- Query: fetch templates, then one `task.findMany` per template with
  `take: HISTORY_LOOKBACK * timesPerCycle`, ordered by
  `cycleStart desc, sessionIndex desc` (`Promise.all`).
- `completedThisCycle` means the newest cycle is fully completed. Response
  shape is unchanged; Nucleus is unaffected.

## Daily digest

Open sessions of multi-session templates get a `(x/y)` suffix in their title
(x = `sessionIndex − 1`).

## Momentum CLI

- `template:create` gains `--times N` (default 1).
- `templates` prints `timesPerCycle`; `tasks` prints the session badge for
  multi-session tasks.
- `task:complete` needs no change (goes through tRPC).

## Testing

All unit tests (Vitest), co-located with the source.

| Test (`it ...`) | Why it matters / what a failure reveals |
| --- | --- |
| `planStatusChange`: spawns the next session when a session below the target is completed | Sessions go missing → silent misses |
| `planStatusChange`: spawns nothing when the final session is completed | Cycle never ends → endless sessions |
| `planStatusChange`: spawns nothing when a session is skipped | Skips don't end the cycle |
| `planStatusChange`: deletes the open next session when a completed session is reopened | Two open sessions per cycle |
| executor: treats a duplicate next-session insert as success | Double-click surfaces as an error |
| `groupIntoCycles`: counts a cycle as a miss when fewer sessions than the target were completed | Inflated streaks/percentages |
| `groupIntoCycles`: counts a cycle as complete when every session was completed | Deflated streaks/percentages |
| `groupIntoCycles`: excludes a cycle whose sessions were all cancelled | Cancelled cycles skew percentage |
| `applyOptimisticStatusChange`: inserts a placeholder next session when a session below the target is completed | Card flicker / missing card until refetch |
| `applyOptimisticStatusChange`: removes the open next session when a completed session is reopened | Duplicate open cards (the `34327b5` bug class) |
| badge formatter: shows completed sessions out of the target for a completed card | Wrong progress shown |
| badge formatter: shows sessions done so far for an open card | Off-by-one progress on open cards |
| `keepLatestTerminalPerTemplate`: keeps only the highest completed session of a cycle | Done column shows multiple cards per cycle |
| cron: starts each new cycle at session one with `cycleStart` equal to the due date | Broken cycle grouping from day one |

## Decisions made during brainstorming

- **Count, not time slots:** any N completions within the cycle satisfy it.
- **Partial cycle = miss (SKIPPED):** no partial credit, no new status.
- **Session-per-row instead of a counter on one Task:** proposed by the user;
  keeps drag-to-Done meaning "this is done", gives per-completion timestamps,
  and avoids redefining what `COMPLETED` means for a partially done task.
- **Explicit cycle columns (option B)** over implicit `dueDate` grouping
  (fragile, no race protection) or a `RecurringCycle` model (heaviest
  migration and write paths for a single-user app).
- **Done column collapses to one card per cycle.**
- **Snooze blocked for multi-session templates** in v1.
- **HA endpoint left unchanged** — no current HA-driven habit needs multiple
  sessions.

## Future work

- **HA endpoint:** before any multi-session template is completed from Home
  Assistant, route `POST /api/automations/complete-recurring-task` through
  `applyTaskStatusChange`. Until then, an HA completion marks the open session
  COMPLETED without spawning the next, so the cycle ends as a miss.
- Expandable Done card listing each session's completion time.
- Per-cycle session counts in the `recurring-status` response (and Nucleus
  widget).
- Snooze support for multi-session weekly/monthly templates.
