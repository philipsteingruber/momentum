# Recurring Templates List Route — Design

## Problem

Nucleus (a separate personal-OS app, `philipsteingruber/nucleus`) wants to
let a habit map to one of Momentum's recurring task templates, so
completing a habit can also complete today's instance of that template via
the existing `POST /api/automations/complete-recurring-task` route. But
there's no way for an external caller to discover which
`recurringTemplateId` values exist — `complete-recurring-task` only accepts
an ID it assumes the caller already has, and the only place
`RecurringTemplate` rows are queryable today is the internal
`recurringTemplate` tRPC router, which requires a Clerk session and isn't
reachable from outside this app.

## Design

New `GET /api/automations/recurring-templates` route, mirroring
`complete-recurring-task`'s auth exactly: the same `isAuthorized`
timing-safe Bearer-token check against `AUTOMATION_API_KEY`, the same
`ADMIN_CLERK_USER_ID`-scoped lookup (single-user app today, no
multi-tenant concern to design around).

Returns `{ id: string; title: string }[]` — just enough for a caller to
build a picker. No recurrence rule, no schedule detail, no status —
Nucleus only needs "which template does this habit map to," not a full
representation of the template.

Query reuses whatever `src/trpc/routers/recurringTemplate.ts`'s existing
list procedure already selects, rather than hand-writing a second Prisma
query for the same data — likely
`prisma.recurringTemplate.findMany({ where: { userId: user.id }, select: { id: true, title: true } })`,
ordered however that router already orders results (consistency over
inventing a new order for the same underlying data).

No cursor pagination or filtering — this is a personal task app for one
user; the realistic count of recurring templates is tens, not thousands.

## Testing

Match `complete-recurring-task/route.test.ts`'s existing coverage shape:
auth-rejected (missing/wrong bearer), empty-list case, populated-list
case. No new test infrastructure needed — same `route.test.ts` pattern
already established in this directory.

## Out of scope

- No create/update/delete on recurring templates via this route —
  read-only. A separate, still-open piece of work (list/create *tasks*,
  not templates) is already tracked on the Nucleus side as blocked on
  Momentum; this route doesn't attempt to close that gap, only the
  narrower "discover template IDs" need.
- No pagination/filtering — see Design section reasoning.
