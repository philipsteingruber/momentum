import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

import { RecurrenceType, TaskStatus } from "@/generated/prisma/enums";
import { cronLog } from "@/lib/cron-logger";
import { prisma } from "@/lib/prisma";
import { groupIntoCycles } from "@/lib/recurring-cycles";
import { MAX_TIMES_PER_CYCLE } from "@/lib/recurring-sessions";

// Read-only status route for external "how am I doing on my recurring
// commitments" views (Nucleus's dashboard Recurring widget). Same auth
// pattern as the other two automations routes, deliberately duplicated.
// See docs/superpowers/specs/2026-08-22-recurring-status-design.md.

const JOB = "automations.recurring-status";
const HISTORY_LOOKBACK = 30;

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

type HistoryEntry = { status: TaskStatus };

/**
 * Each entry is one cycle (day or week; sessions are collapsed by
 * `groupIntoCycles`), so "N consecutive completed cycles" IS the streak — no
 * calendar arithmetic needed, cadence-agnostic by construction. The newest
 * cycle, if still PENDING (cycle not yet resolved), is set aside
 * rather than treated as a break — this is the "forgiving" rule: only a
 * genuinely resolved-but-missed cycle breaks the streak, not one still
 * in progress.
 */
function computeStreak(historyNewestFirst: HistoryEntry[]): number {
  let startIndex = 0;
  if (historyNewestFirst[0]?.status === TaskStatus.PENDING) {
    startIndex = 1;
  }

  let streak = 0;
  for (let i = startIndex; i < historyNewestFirst.length; i++) {
    if (historyNewestFirst[i].status === TaskStatus.COMPLETED) {
      streak += 1;
    } else {
      break;
    }
  }
  return streak;
}

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
    where: {
      userId: user.id,
      recurrenceType: { in: [RecurrenceType.DAILY, RecurrenceType.WEEKLY] },
    },
    select: {
      id: true,
      title: true,
      recurrenceType: true,
      timesPerCycle: true,
      tasks: {
        select: { status: true, cycleStart: true },
        // nulls last: detached (cycle-less) cancelled tasks must not push real cycles out of the window
        orderBy: [{ cycleStart: { sort: "desc", nulls: "last" } }, { sessionIndex: "desc" }],
        take: HISTORY_LOOKBACK * MAX_TIMES_PER_CYCLE,
      },
    },
    orderBy: { title: "asc" },
  });

  const response = templates.map((template) => {
    const cycles = groupIntoCycles(template.tasks, template.timesPerCycle ?? 1).slice(0, HISTORY_LOOKBACK);
    return {
      id: template.id,
      title: template.title,
      recurrenceType: template.recurrenceType,
      completedThisCycle: cycles[0]?.status === TaskStatus.COMPLETED,
      currentStreak: computeStreak(cycles),
      completionPercentage: computeCompletionPercentage(cycles),
    };
  });

  await cronLog({ runId, job: JOB, event: "list", level: "info", data: { count: response.length } });

  return Response.json(response);
}
