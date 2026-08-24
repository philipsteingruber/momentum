# Recurring Status: trailing completion percentage — Design

## Problem

Nucleus's dashboard "Recurring" widget shows each habit's current streak
(🔥 N) but nothing about how consistent it's been overall — a 3-day streak
looks identical whether it follows a near-perfect month or a habit that's
mostly lapsed. The user wants a percentage alongside the streak.

`GET /api/automations/recurring-status` (this repo) already fetches each
template's last `HISTORY_LOOKBACK` (30) task instances, newest first, to
compute `currentStreak` — but discards everything about that history except
whether it forms a consecutive completed run from the top. That same data
is enough to compute a trailing completion percentage with no new query.

## Design

### `computeCompletionPercentage` — new function, `route.ts`

Sibling to the existing `computeStreak`, operating on the same
`HistoryEntry[]` (`{ status: TaskStatus }`, newest first):

```typescript
function computeCompletionPercentage(historyNewestFirst: HistoryEntry[]): number | null {
  // Same forgiving exclusion as computeStreak: the newest cycle, if still
  // PENDING (not yet due/resolved), isn't judged yet.
  let startIndex = 0;
  if (historyNewestFirst[0]?.status === TaskStatus.PENDING) {
    startIndex = 1;
  }

  let completed = 0;
  let counted = 0;
  for (let i = startIndex; i < historyNewestFirst.length; i++) {
    const status = historyNewestFirst[i].status;
    if (status === TaskStatus.CANCELLED) continue; // cycle never should have existed — excluded entirely
    counted += 1;
    if (status === TaskStatus.COMPLETED) completed += 1;
    // SKIPPED counts as a miss (deliberate skip). A stale PENDING/IN_PROGRESS/
    // BLOCKED cycle older than the newest one is also treated as a miss —
    // the forgiving exclusion only applies to the newest entry.
  }
  return counted === 0 ? null : Math.round((completed / counted) * 100);
}
```

`null` (not `0`) when `counted === 0` — a brand-new template with no
resolved history yet shouldn't render as "0%".

### Route response

`GET`'s `response.map(...)` gains one field, computed from the same
`template.tasks` already passed to `computeStreak`:

```typescript
completionPercentage: computeCompletionPercentage(template.tasks),
```

Full response shape becomes
`{ id, title, recurrenceType, completedThisCycle, currentStreak, completionPercentage }`.

### Nucleus consumer (`nucleus` repo, not this one)

- `src/lib/services/momentum.ts`: `MomentumRecurringStatus` gains
  `completionPercentage: number | null`, mirroring this route's response
  exactly (existing convention — see that file's own design doc).
- `src/app/(app)/page.tsx`'s `MomentumWidget`: renders the percentage next
  to the streak (e.g. muted `77%` text), shown only when non-null — mirrors
  the streak's existing `> 0` guard for "don't show a number that isn't
  meaningful yet."

## Decisions made during brainstorming

- **What the percentage means:** trailing completion rate over the existing
  30-cycle lookback window (not streak-relative-to-personal-best, not a
  calendar-aligned this-week/this-month rate) — cheapest to add, reuses data
  already fetched.
- **SKIPPED vs CANCELLED:** SKIPPED counts as a miss (a deliberate skip is a
  real miss); CANCELLED is excluded from the denominator entirely (the cycle
  never should have existed).
- **Newest-cycle handling:** excluded from both numerator and denominator
  when still PENDING, exactly matching `computeStreak`'s existing forgiving
  rule — kept the two calculations consistent rather than let them diverge
  on the same input.

## Testing

New cases in `route.test.ts`, following the existing `template(...)` test
helper:

- All-completed history → 100%.
- History including a SKIPPED entry → counts against the percentage.
- History including a CANCELLED entry → excluded, doesn't shrink the
  denominator's effective total.
- Newest entry PENDING → excluded from the calculation (percentage computed
  over the remaining resolved history).
- Zero resolved history (e.g. one entry, PENDING) → `null`, not `0`.

No Nucleus-side test — matches `MomentumWidget`'s existing convention (no
component test for this class of thin fetch+render widget, per the
2026-08-22 recurring-status widget design doc).

## Out of scope

- No historical/calendar view.
- No change to `HISTORY_LOOKBACK` (percentage and streak share the same
  30-cycle window).
- No change to the "forgiving" streak rule itself — only the new function
  mirrors it.
