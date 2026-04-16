# Category Exclusions for Shared Access — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow a grantor to hide specific categories (and their tasks) from users they have shared access with, on a per-grant basis.

**Architecture:** A new `AccessGrantCategoryExclusion` join table stores which categories are excluded per grant. The three tRPC procedures that read shared data (`getTasksForGrantor`, `getCategoriesForGrantor`, `getTaskByIdForGrantor`) are updated to filter out excluded categories. The settings page gains a `ManageVisibilityPopover` component rendered inline on each "grants given" row, where category visibility is toggled immediately via a `toggleExclusion` mutation.

**Tech Stack:** Prisma (PostgreSQL), tRPC, Next.js App Router, next-intl, shadcn/ui (Popover, Switch), Sonner (toasts)

---

## File Map

| Action   | File                                                         | Responsibility                                         |
|----------|--------------------------------------------------------------|--------------------------------------------------------|
| Modify   | `prisma/schema.prisma`                                       | Add `AccessGrantCategoryExclusion` model + back-refs   |
| Modify   | `src/trpc/routers/shared-access.ts`                          | New procedures + filtered data queries                 |
| Modify   | `messages/en.json`                                           | New translation strings (English)                      |
| Modify   | `messages/sv.json`                                           | New translation strings (Swedish)                      |
| Create   | `src/_components/forms/manage-visibility-popover.tsx`        | Popover UI for toggling category visibility per grant  |
| Modify   | `src/app/settings/shared-access/page.tsx`                   | Wire `ManageVisibilityPopover` into grants-given rows  |

---

## Task 1: Schema — Add `AccessGrantCategoryExclusion`

**Files:**

- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add the `categoryExclusions` relation to `UserAccessGrant`**

In `prisma/schema.prisma`, add `categoryExclusions` to the `UserAccessGrant` model:

```prisma
model UserAccessGrant {
    id     String      @id @default(cuid())
    status GrantStatus @default(PENDING)

    grantor   User   @relation("GrantsGiven", fields: [grantorId], references: [id], onDelete: Cascade)
    grantorId String

    grantee   User   @relation("GrantsReceived", fields: [granteeId], references: [id], onDelete: Cascade)
    granteeId String

    createdAt DateTime @default(now())
    updatedAt DateTime @updatedAt

    categoryExclusions AccessGrantCategoryExclusion[]

    @@unique([grantorId, granteeId])
    @@index([granteeId, status])
    @@index([grantorId, status])
}
```

- [ ] **Step 2: Add the `accessGrantExclusions` relation to `Category`**

```prisma
model Category {
    id String @id @default(cuid())

    name  String
    color String?

    createdAt DateTime @default(now())
    updatedAt DateTime @updatedAt

    tasks              Task[]
    user               User                @relation(fields: [userId], references: [id], onDelete: Cascade)
    userId             String
    recurringTemplates RecurringTemplate[]
    accessGrantExclusions AccessGrantCategoryExclusion[]

    @@unique([userId, name])
    @@index([userId])
}
```

- [ ] **Step 3: Add the `AccessGrantCategoryExclusion` model**

Append this model at the bottom of `prisma/schema.prisma` (before the closing of the file):

```prisma
model AccessGrantCategoryExclusion {
    id String @id @default(cuid())

    grant      UserAccessGrant @relation(fields: [grantId], references: [id], onDelete: Cascade)
    grantId    String

    category   Category @relation(fields: [categoryId], references: [id], onDelete: Cascade)
    categoryId String

    createdAt DateTime @default(now())

    @@unique([grantId, categoryId])
    @@index([grantId])
}
```

- [ ] **Step 4: Push schema to the database**

```bash
pnpm prisma db push
```

Expected output ends with: `Your database is now in sync with your Prisma schema.`

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(shared-access): add AccessGrantCategoryExclusion schema"
```

---

## Task 2: tRPC — New procedures and filtered data queries

**Files:**

- Modify: `src/trpc/routers/shared-access.ts`

- [ ] **Step 1: Add `getAcceptedGrantExcludedIds` helper**

This replaces `assertAcceptedGrant` in the three data-reading procedures that need category filtering. It performs the same access check but also returns the list of excluded category IDs in a single query, avoiding a second round trip.

Add this function directly below the existing `assertAcceptedGrant` function:

```typescript
async function getAcceptedGrantExcludedIds(ctx: AuthedContext, grantorId: string): Promise<string[]> {
  const grant = await ctx.db.userAccessGrant.findFirst({
    where: {
      grantorId,
      granteeId: ctx.currentUser.id,
      status: GrantStatus.ACCEPTED,
    },
    include: {
      categoryExclusions: { select: { categoryId: true } },
    },
  });

  if (!grant) {
    throw new TRPCError({ code: "FORBIDDEN", message: "You do not have access to this user's data." });
  }

  return grant.categoryExclusions.map((e) => e.categoryId);
}
```

- [ ] **Step 2: Add `getExclusionsForGrant` query procedure**

Add this inside the `sharedAccessRouter` object, in the `// ─── Queries ───` section, after `getPendingCount`:

```typescript
getExclusionsForGrant: authedProcedure
  .input(z.object({ grantId: z.cuid() }))
  .query(async ({ ctx, input }) => {
    const grant = await ctx.db.userAccessGrant.findFirst({
      where: { id: input.grantId, grantorId: ctx.currentUser.id },
    });

    if (!grant) {
      throw new TRPCError({ code: "NOT_FOUND" });
    }

    const exclusions = await ctx.db.accessGrantCategoryExclusion.findMany({
      where: { grantId: input.grantId },
      select: { categoryId: true },
    });

    return exclusions.map((e) => e.categoryId);
  }),
```

- [ ] **Step 3: Add `toggleExclusion` mutation procedure**

Add this in the `// ─── Grant management ───` section, after `remove`:

```typescript
toggleExclusion: authedProcedure
  .input(z.object({ grantId: z.cuid(), categoryId: z.cuid() }))
  .mutation(async ({ ctx, input }) => {
    const grant = await ctx.db.userAccessGrant.findFirst({
      where: { id: input.grantId, grantorId: ctx.currentUser.id },
    });

    if (!grant) {
      throw new TRPCError({ code: "NOT_FOUND" });
    }

    const existing = await ctx.db.accessGrantCategoryExclusion.findUnique({
      where: {
        grantId_categoryId: {
          grantId: input.grantId,
          categoryId: input.categoryId,
        },
      },
    });

    if (existing) {
      await ctx.db.accessGrantCategoryExclusion.delete({
        where: {
          grantId_categoryId: {
            grantId: input.grantId,
            categoryId: input.categoryId,
          },
        },
      });
      return { excluded: false };
    }

    await ctx.db.accessGrantCategoryExclusion.create({
      data: { grantId: input.grantId, categoryId: input.categoryId },
    });

    return { excluded: true };
  }),
```

- [ ] **Step 4: Update `getTasksForGrantor` to filter excluded categories**

Replace the `assertAcceptedGrant` call and `findMany` call in `getTasksForGrantor` with the following. The key change is: (a) use `getAcceptedGrantExcludedIds` instead of `assertAcceptedGrant`, (b) add a category filter to the `where` clause that keeps tasks where `categoryId` is null (uncategorized) or not in the excluded list:

```typescript
getTasksForGrantor: authedProcedure
  .input(z.object({ grantorId: z.cuid() }))
  .query(async ({ ctx, input }) => {
    const excludedCategoryIds = await getAcceptedGrantExcludedIds(ctx, input.grantorId);

    const cutoff = subDays(new Date(), 14);

    const tasks = await ctx.db.task.findMany({
      where: {
        userId: input.grantorId,
        status: { not: TaskStatus.SKIPPED },
        NOT: {
          AND: [
            { status: { in: [...TERMINAL_TASK_STATUSES] } },
            { OR: [{ completedAt: { lt: cutoff } }, { completedAt: null }] },
          ],
        },
        ...(excludedCategoryIds.length > 0
          ? {
              OR: [
                { categoryId: null },
                { categoryId: { notIn: excludedCategoryIds } },
              ],
            }
          : {}),
      },
      include: {
        notes: true,
        tags: true,
      },
      orderBy: { createdAt: "asc" },
    });

    const latestByTemplate = new Map<string, { id: string; ts: number }>();
    for (const task of tasks) {
      if (task.recurringTemplateId && (TERMINAL_TASK_STATUSES as readonly TaskStatus[]).includes(task.status)) {
        const ts = task.createdAt.getTime();
        const existing = latestByTemplate.get(task.recurringTemplateId);
        if (!existing || ts > existing.ts) {
          latestByTemplate.set(task.recurringTemplateId, { id: task.id, ts });
        }
      }
    }

    return tasks.filter((task) => {
      if (!task.recurringTemplateId || !(TERMINAL_TASK_STATUSES as readonly TaskStatus[]).includes(task.status)) {
        return true;
      }
      return latestByTemplate.get(task.recurringTemplateId)?.id === task.id;
    });
  }),
```

- [ ] **Step 5: Update `getCategoriesForGrantor` to filter excluded categories**

Replace the entire `getCategoriesForGrantor` procedure:

```typescript
getCategoriesForGrantor: authedProcedure
  .input(z.object({ grantorId: z.cuid() }))
  .query(async ({ ctx, input }) => {
    const excludedCategoryIds = await getAcceptedGrantExcludedIds(ctx, input.grantorId);

    return await ctx.db.category.findMany({
      where: {
        userId: input.grantorId,
        ...(excludedCategoryIds.length > 0 ? { id: { notIn: excludedCategoryIds } } : {}),
      },
      orderBy: { name: "asc" },
    });
  }),
```

- [ ] **Step 6: Update `getTaskByIdForGrantor` to block excluded category access**

Replace the entire `getTaskByIdForGrantor` procedure. After fetching the task, check whether its `categoryId` is in the excluded list and throw `FORBIDDEN` if so. The error message intentionally matches the NOT_FOUND message to avoid leaking whether the task exists:

```typescript
getTaskByIdForGrantor: authedProcedure
  .input(z.object({ grantorId: z.cuid(), taskId: z.cuid() }))
  .query(async ({ ctx, input }) => {
    const excludedCategoryIds = await getAcceptedGrantExcludedIds(ctx, input.grantorId);

    const task = await ctx.db.task.findUnique({
      where: { id: input.taskId, userId: input.grantorId },
      include: {
        notes: { orderBy: { createdAt: "desc" } },
        category: true,
        tags: true,
      },
    });

    if (!task) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "This task doesn't exist or you don't have access to see it.",
      });
    }

    if (task.categoryId && excludedCategoryIds.includes(task.categoryId)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "This task doesn't exist or you don't have access to see it.",
      });
    }

    return task;
  }),
```

- [ ] **Step 7: Verify TypeScript compiles cleanly**

```bash
pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/trpc/routers/shared-access.ts
git commit -m "feat(shared-access): add category exclusion procedures and filter shared data queries"
```

---

## Task 3: i18n — Add translation strings

**Files:**

- Modify: `messages/en.json`
- Modify: `messages/sv.json`

- [ ] **Step 1: Add English strings to `SharedAccessSettings` in `messages/en.json`**

Inside the `"SharedAccessSettings"` object, after the last existing key (`"declineSuccess"`), add:

```json
"manageVisibilityButton": "Manage visibility",
"manageVisibilityTitle": "Category Visibility",
"manageVisibilityDescription": "Choose which categories {name} can see. Hidden categories and their tasks won't be visible.",
"noCategories": "You have no categories.",
"toggleExclusionError": "Failed to update visibility."
```

- [ ] **Step 2: Add Swedish strings to `SharedAccessSettings` in `messages/sv.json`**

Inside the `"SharedAccessSettings"` object, after the last existing key (`"declineSuccess"`), add:

```json
"manageVisibilityButton": "Hantera synlighet",
"manageVisibilityTitle": "Kategorisynlighet",
"manageVisibilityDescription": "Välj vilka kategorier {name} kan se. Dolda kategorier och deras uppgifter kommer inte vara synliga.",
"noCategories": "Du har inga kategorier.",
"toggleExclusionError": "Det gick inte att uppdatera synlighet."
```

- [ ] **Step 3: Commit**

```bash
git add messages/en.json messages/sv.json
git commit -m "feat(shared-access): add i18n strings for category visibility"
```

---

## Task 4: UI — `ManageVisibilityPopover` component

**Files:**

- Create: `src/_components/forms/manage-visibility-popover.tsx`

- [ ] **Step 1: Create the component**

The component fetches the grantor's own categories (`category.getAll`) and the current exclusion list for the grant (`sharedAccess.getExclusionsForGrant`). Each category renders as a row with a `Switch` — checked means visible (not excluded), unchecked means hidden (excluded). Toggling immediately fires `toggleExclusion`.

Create `src/_components/forms/manage-visibility-popover.tsx`:

```tsx
"use client";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/trpc/client";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

interface ManageVisibilityPopoverProps {
  grantId: string;
  granteeName: string;
}

export function ManageVisibilityPopover({ grantId, granteeName }: ManageVisibilityPopoverProps) {
  const t = useTranslations("SharedAccessSettings");
  const trpcUtils = trpc.useUtils();

  const { data: categories, isPending: isLoadingCategories } = trpc.category.getAll.useQuery();
  const { data: excludedCategoryIds, isPending: isLoadingExclusions } = trpc.sharedAccess.getExclusionsForGrant.useQuery({ grantId });

  const { mutate: toggleExclusion } = trpc.sharedAccess.toggleExclusion.useMutation({
    onSuccess: () => {
      trpcUtils.sharedAccess.getExclusionsForGrant.invalidate({ grantId });
    },
    onError: () => {
      toast.error(t("toggleExclusionError"));
    },
  });

  const isLoading = isLoadingCategories || isLoadingExclusions;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          {t("manageVisibilityButton")}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64" align="end">
        <div className="flex flex-col gap-y-3">
          <div>
            <p className="text-sm font-medium">{t("manageVisibilityTitle")}</p>
            <p className="text-muted-foreground text-xs">
              {t("manageVisibilityDescription", { name: granteeName })}
            </p>
          </div>
          {isLoading ? (
            <Spinner />
          ) : !categories || categories.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("noCategories")}</p>
          ) : (
            <div className="flex flex-col gap-y-2">
              {categories.map((category) => {
                const isExcluded = excludedCategoryIds?.includes(category.id) ?? false;
                return (
                  <div key={category.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-x-2">
                      {category.color && (
                        <span
                          className="inline-block h-3 w-3 rounded-full"
                          style={{ backgroundColor: category.color }}
                        />
                      )}
                      <span className="text-sm">{category.name}</span>
                    </div>
                    <Switch
                      checked={!isExcluded}
                      onCheckedChange={() =>
                        toggleExclusion({ grantId, categoryId: category.id })
                      }
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles cleanly**

```bash
pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/_components/forms/manage-visibility-popover.tsx
git commit -m "feat(shared-access): add ManageVisibilityPopover component"
```

---

## Task 5: UI — Wire popover into the settings page

**Files:**

- Modify: `src/app/settings/shared-access/page.tsx`

- [ ] **Step 1: Import `ManageVisibilityPopover`**

Add this import at the top of `src/app/settings/shared-access/page.tsx`, alongside the other component imports:

```tsx
import { ManageVisibilityPopover } from "@/_components/forms/manage-visibility-popover";
```

- [ ] **Step 2: Replace the single Revoke button with a button group**

Find the grants-given row (inside `grantsGiven.map`). Replace the current right-side `<Button>` with a `<div>` containing both the popover and the revoke button:

Replace:

```tsx
<Button variant={"outline"} size={"sm"} onClick={() => revoke({ grantId: grant.id })}>
  {t("revokeButton")}
</Button>
```

With:

```tsx
<div className="flex items-center gap-x-2">
  <ManageVisibilityPopover
    grantId={grant.id}
    granteeName={grant.grantee.name ?? grant.grantee.email}
  />
  <Button variant={"outline"} size={"sm"} onClick={() => revoke({ grantId: grant.id })}>
    {t("revokeButton")}
  </Button>
</div>
```

- [ ] **Step 3: Verify TypeScript compiles cleanly**

```bash
pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Manual verification**

Start the dev server:

```bash
pnpm dev
```

Check the following scenarios in the browser at `/settings/shared-access`:

1. **Button appears** — Each accepted or pending grant in "Access I've given" shows a "Manage visibility" button next to Revoke.
2. **Popover opens** — Clicking the button shows a popover listing all your categories with switches, all toggled ON by default.
3. **Toggle hides tasks** — Flip a category switch to OFF. Navigate to `/shared/[userId]` as the grantee. Tasks in that category should no longer appear, and the category should not appear in the filter sidebar.
4. **Toggle shows tasks** — Flip the same switch back to ON. Verify the tasks are visible again.
5. **Direct URL blocked** — While a category is excluded, copy a direct task URL from that category (e.g. `/shared/[userId]/task/[taskId]`). Accessing it as the grantee should show the "not found" or "no access" error.
6. **Uncategorized tasks always visible** — Ensure tasks with no category continue to appear regardless of any exclusions.
7. **No categories state** — If the grantor has no categories, the popover should show "You have no categories."

- [ ] **Step 5: Commit**

```bash
git add src/app/settings/shared-access/page.tsx
git commit -m "feat(shared-access): wire ManageVisibilityPopover into settings page"
```

---

## Self-Review

### Spec coverage

| Requirement | Covered by |
|---|---|
| Both category and its tasks are hidden | Tasks 2 (steps 4–5), direct URL guard (step 6) |
| Uncategorized tasks always visible | Task 2 step 4 — `OR [{ categoryId: null }, ...]` |
| All categories visible by default (opt-out) | No rows in `AccessGrantCategoryExclusion` = nothing excluded |
| Join table with cascade deletes | Task 1 — both FK relations have `onDelete: Cascade` |
| Grantor configures at any time (any grant status) | Task 2 `toggleExclusion` — only checks `grantorId`, not status |
| UI inline on settings page | Task 5 |
| Auto-save per toggle | Task 4 — `onCheckedChange` fires mutation immediately |
| Direct task URL blocked | Task 2 step 6 — `FORBIDDEN` thrown if categoryId excluded |
| Both locale files updated | Task 3 |

### Placeholder scan

No TBDs, TODOs, or "similar to task N" references found.

### Type consistency

- `getAcceptedGrantExcludedIds` returns `string[]` — used as `excludedCategoryIds: string[]` in all three procedures ✓
- `getExclusionsForGrant` returns `string[]` — consumed as `excludedCategoryIds` in `ManageVisibilityPopover` ✓
- `toggleExclusion` input: `{ grantId: z.cuid(), categoryId: z.cuid() }` — matches call site in component ✓
- Prisma compound unique name `grantId_categoryId` matches `@@unique([grantId, categoryId])` ✓
