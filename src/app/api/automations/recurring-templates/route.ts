import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

import { cronLog } from "@/lib/cron-logger";
import { prisma } from "@/lib/prisma";

// Read-only counterpart to complete-recurring-task/route.ts's write path — lets a
// trusted external caller (Nucleus's habit-editor dropdown) discover which
// recurringTemplateId values exist, so it can map a habit to one without direct
// database access. Same auth pattern, deliberately duplicated rather than shared
// (no shared auth helper exists yet for these routes).

const JOB = "automations.recurring-templates";

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

  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) {
    await cronLog({ runId, job: JOB, event: "admin_user.not_found", level: "error" });
    return new Response("Admin user not found", { status: 500 });
  }

  const templates = await prisma.recurringTemplate.findMany({
    where: { userId: user.id },
    select: { id: true, title: true },
    orderBy: { title: "asc" },
  });

  await cronLog({ runId, job: JOB, event: "list", level: "info", data: { count: templates.length } });

  return Response.json(templates);
}
