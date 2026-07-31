import { TaskStatus } from "@/generated/prisma/enums";
import { cronLog } from "@/lib/cron-logger";
import { prisma } from "@/lib/prisma";
import type { NextRequest } from "next/server";
import { z } from "zod";

// Lets trusted external automations (e.g. a Home Assistant notification-action
// event) complete today's instance of a recurring task without a Clerk session.
// Only the recurringTemplateId is known to the caller, since a new Task row is
// generated per occurrence - so we resolve it to the current open instance here,
// the same way the /today and /list Discord commands do.

const JOB = "automations.complete-recurring-task";

const bodySchema = z.object({ recurringTemplateId: z.string() });

function isAuthorized(req: NextRequest): boolean {
  const expected = process.env.AUTOMATION_API_KEY;
  if (!expected) return false;
  const header = req.headers.get("authorization");
  return header === `Bearer ${expected}`;
}

export async function POST(req: NextRequest): Promise<Response> {
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

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    await cronLog({ runId, job: JOB, event: "body.invalid", level: "error" });
    return new Response("Invalid body: expected { recurringTemplateId: string }", { status: 400 });
  }

  const { recurringTemplateId } = parsed.data;
  await cronLog({ runId, job: JOB, event: "start", level: "info", data: { recurringTemplateId } });

  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) {
    await cronLog({ runId, job: JOB, event: "admin_user.not_found", level: "error", data: { recurringTemplateId } });
    return new Response("Admin user not found", { status: 500 });
  }

  const task = await prisma.task.findFirst({
    where: {
      userId: user.id,
      recurringTemplateId,
      status: { notIn: [TaskStatus.COMPLETED, TaskStatus.CANCELLED, TaskStatus.SKIPPED] },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!task) {
    await cronLog({ runId, job: JOB, event: "task.not_found", level: "warn", data: { recurringTemplateId } });
    return new Response("No open task instance found for this recurring template", { status: 404 });
  }

  await prisma.task.update({
    where: { id: task.id },
    data: { status: TaskStatus.COMPLETED, completedAt: new Date() },
  });

  await cronLog({
    runId,
    job: JOB,
    event: "task.completed",
    level: "info",
    data: { recurringTemplateId, taskId: task.id, title: task.title },
  });

  return Response.json({ completedTaskId: task.id, title: task.title });
}
