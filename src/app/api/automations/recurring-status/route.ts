import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

import { RecurrenceType, TaskStatus } from "@/generated/prisma/enums";
import { cronLog } from "@/lib/cron-logger";
import { prisma } from "@/lib/prisma";

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
 * Each template generates exactly one Task per cycle (day or week), so
 * "N consecutive completed instances" IS the streak — no calendar
 * arithmetic needed, cadence-agnostic by construction. The newest
 * instance, if still PENDING (cycle not yet resolved), is set aside
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
      tasks: {
        select: { status: true },
        orderBy: { dueDate: "desc" },
        take: HISTORY_LOOKBACK,
      },
    },
    orderBy: { title: "asc" },
  });

  const response = templates.map((template) => ({
    id: template.id,
    title: template.title,
    recurrenceType: template.recurrenceType,
    completedThisCycle: template.tasks[0]?.status === TaskStatus.COMPLETED,
    currentStreak: computeStreak(template.tasks),
  }));

  await cronLog({ runId, job: JOB, event: "list", level: "info", data: { count: response.length } });

  return Response.json(response);
}
