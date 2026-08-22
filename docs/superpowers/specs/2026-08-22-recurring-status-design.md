# Recurring Status Route — Design

## Problem

Nucleus's dashboard `Tasks` widget currently shows a flat list of active tasks
(one-off and recurring mixed, via `GET /api/automations/tasks`). The user
wants a widget "focused on recurring tasks... not individual ones" — how
they're doing on their recurring commitments (Dishwasher, Take Medicine,
etc.), not a to-do list. Neither `/tasks` nor `/recurring-templates`
(id+title only) can drive that: nothing exposes per-template current-cycle
status or streak.

## Design

New `GET /api/automations/recurring-status`, same Bearer-auth pattern as the
other two automations routes. Scoped to `recurrenceType IN (DAILY, WEEKLY)`
— monthly (and any future cadence) excluded per explicit decision, since a
"streak" doesn't read naturally at that cadence and it's out of scope for
this widget.

For each qualifying template, walks its `Task` history (already one row per
cycle — `generate-tasks` creates exactly one instance per template per
interval) ordered newest-first:

```
tasks = last 30 Task rows for this template, ordered by dueDate desc
streak = 0
startIndex = 0
if tasks[0]?.status === PENDING:
  startIndex = 1   # current cycle unresolved — set aside, not a break
for i from startIndex to tasks.length:
  if tasks[i].status === COMPLETED: streak += 1
  else: break        # CANCELLED/SKIPPED/gap breaks the streak
completedThisCycle = tasks[0]?.status === COMPLETED
```

This is deliberately **not** calendar-day/week arithmetic — since each
template already generates exactly one `Task` per cycle, "N consecutive
completed instances" *is* the streak, cadence-agnostic. This also
implements the "forgiving" rule from the same design conversation that
changed Nucleus's local `computeStreak`: the current (still-open) cycle
never counts as a break, only a genuinely resolved-but-missed cycle does.

**Response shape**, matching what the widget needs directly (no further
Nucleus-side computation):

```typescript
type RecurringStatus = {
  id: string;
  title: string;
  recurrenceType: "DAILY" | "WEEKLY";
  completedThisCycle: boolean;
  currentStreak: number;
};
```

**30-row lookback bound**: generous enough that a real gap always surfaces
within the window (even a template due weekly gets ~7 months of history),
without an unbounded query per template.

## Testing

Route-level tests (mirroring the existing route-test depth in this repo):
auth failures, missing/empty template list, an unbroken streak, a streak
broken by a gap, a streak broken by an explicit `CANCELLED`/`SKIPPED`
instance, and — the case that actually exercises the "forgiving" rule — a
template whose newest instance is still `PENDING` but whose prior instances
are all `COMPLETED` (streak should count those, not zero out because the
newest one isn't resolved yet).

## Out of scope

- Monthly (or other) recurrence cadences — excluded per explicit decision.
- Any write path — this is read-only, matching the other two automations
  routes.
- Historical detail beyond current streak (e.g. a full completion calendar)
  — the widget only needs "done this cycle + how long a streak," not a
  history view.
