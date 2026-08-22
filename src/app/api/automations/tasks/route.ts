import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

import { TaskStatus } from "@/generated/prisma/enums";
import { cronLog } from "@/lib/cron-logger";
import { prisma } from "@/lib/prisma";
import { formatInTimeZone } from "date-fns-tz";

// Read-only counterpart to complete-recurring-task/recurring-templates — lets a
// trusted external caller (Nucleus's dashboard Tasks widget) see the current
// active task list without a Clerk session. Same auth pattern as the other two
// automations routes, deliberately duplicated rather than shared.

const JOB = "automations.tasks";

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

  const user = await prisma.user.findUnique({
    where: { clerkId },
    include: { userSettings: true },
  });
  if (!user) {
    await cronLog({ runId, job: JOB, event: "admin_user.not_found", level: "error" });
    return new Response("Admin user not found", { status: 500 });
  }

  // Same "active tasks" definition /list's Discord command uses — everything
  // not yet in a terminal state, not narrowed to "due today" (see design doc:
  // a due-today-only filter would make the widget say "Nothing due" even with
  // several genuinely active recurring commitments that just aren't urgent yet).
  const tasks = await prisma.task.findMany({
    where: {
      userId: user.id,
      status: { notIn: [TaskStatus.COMPLETED, TaskStatus.CANCELLED, TaskStatus.SKIPPED] },
    },
    select: { id: true, title: true, dueDate: true, status: true },
    orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }],
    take: 50,
  });

  const timezone = user.userSettings?.timezone ?? "UTC";
  const response = tasks.map((task) => ({
    id: task.id,
    title: task.title,
    dueDate: task.dueDate ? formatInTimeZone(task.dueDate, timezone, "yyyy-MM-dd") : null,
    status: task.status,
  }));

  await cronLog({ runId, job: JOB, event: "list", level: "info", data: { count: response.length } });

  return Response.json(response);
}
