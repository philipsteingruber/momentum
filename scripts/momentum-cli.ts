import "dotenv/config";
import { TaskStatus, RecurrenceType } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { createCallerFactory, createTRPCContext } from "@/trpc/init";
import { appRouter } from "@/trpc/routers/_app";

type Context = Awaited<ReturnType<typeof createTRPCContext>>;
const createCaller = createCallerFactory(appRouter);
type AppCaller = ReturnType<typeof createCaller>;

// This script runs outside a Next.js request, so Clerk's auth() has nothing to read from.
// We build the tRPC context by hand for a single fixed user instead of going through HTTP.
async function buildContext(): Promise<Context> {
  const clerkId = process.env.ADMIN_CLERK_USER_ID;
  if (!clerkId) throw new Error("ADMIN_CLERK_USER_ID is not set");

  const currentUser = await prisma.user.findUnique({
    where: { clerkId },
    include: { userSettings: true },
  });

  if (!currentUser?.userSettings) {
    throw new Error("Could not find a user with settings for ADMIN_CLERK_USER_ID");
  }

  return { db: prisma, auth: { userId: clerkId }, currentUser } as unknown as Context;
}

function parseArgs(argv: string[]) {
  const positional: string[] = [];
  const flags: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      flags[arg.slice(2)] = argv[i + 1];
      i++;
    } else {
      positional.push(arg);
    }
  }
  return { positional, flags };
}

async function resolveCategoryId(caller: AppCaller, nameOrId: string) {
  if (/^c[a-z0-9]{20,}$/i.test(nameOrId)) return nameOrId;
  const categories = await caller.category.getAll();
  const match = categories.find((c) => c.name.toLowerCase() === nameOrId.toLowerCase());
  if (!match) {
    throw new Error(`No category named "${nameOrId}". Available: ${categories.map((c) => c.name).join(", ")}`);
  }
  return match.id;
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  const { positional, flags } = parseArgs(rest);
  const ctx = await buildContext();
  const caller = createCaller(ctx);

  switch (command) {
    case "categories": {
      const categories = await caller.category.getAll();
      for (const c of categories) {
        console.log(`${c.id}  ${c.name}  (${c.taskCount} active, ${c.overdueTaskCount} overdue)`);
      }
      break;
    }

    case "category:create": {
      if (!flags.name) throw new Error("--name is required");
      const category = await caller.category.create({ name: flags.name, color: flags.color });
      console.log(`Created category ${category.id}: ${category.name}`);
      break;
    }

    case "tasks": {
      const status = flags.status as TaskStatus | undefined;
      const tasks = await caller.task.getAll({ status, search: flags.search });
      for (const t of tasks) {
        console.log(`${t.id}  [${t.status}]  ${t.title}  due:${t.dueDate?.toISOString().slice(0, 10) ?? "-"}`);
      }
      break;
    }

    case "task": {
      const task = await caller.task.getById({ taskId: positional[0] });
      console.log(JSON.stringify(task, null, 2));
      break;
    }

    case "task:create": {
      if (!flags.title || !flags.category) throw new Error("--title and --category are required");
      const categoryId = await resolveCategoryId(caller, flags.category);
      const task = await caller.task.create({
        title: flags.title,
        categoryId,
        description: flags.desc,
        link: flags.link,
        externalContact: flags.contact,
        dueDate: flags.due ? new Date(`${flags.due}T00:00:00`) : undefined,
        timezone: ctx.currentUser!.userSettings!.timezone,
      });
      console.log(`Created ${task.id}: ${task.title}`);
      break;
    }

    case "task:status": {
      const [taskId, newStatus] = positional;
      const task = await caller.task.updateStatus({ taskId, newStatus: newStatus as TaskStatus });
      console.log(`${task.id} -> ${task.status}`);
      break;
    }

    case "task:complete": {
      const task = await caller.task.updateStatus({ taskId: positional[0], newStatus: TaskStatus.COMPLETED });
      console.log(`${task.id} -> ${task.status}`);
      break;
    }

    case "task:snooze": {
      const [taskId, days] = positional;
      const task = await caller.task.snooze({ taskId, days: Number(days) });
      console.log(`${task.id} snoozed to ${task.dueDate?.toISOString().slice(0, 10)}`);
      break;
    }

    case "task:delete": {
      await caller.task.delete({ taskId: positional[0] });
      console.log(`Deleted ${positional[0]}`);
      break;
    }

    case "templates": {
      const templates = await caller.recurringTemplate.getAll();
      for (const t of templates) {
        console.log(`${t.id}  ${t.title}  (${t.recurrenceType})`);
      }
      break;
    }

    case "template:create": {
      if (!flags.title || !flags.category || !flags.recurrence) {
        throw new Error("--title, --category, and --recurrence (DAILY|WEEKLY|MONTHLY) are required");
      }
      const categoryId = await resolveCategoryId(caller, flags.category);
      const template = await caller.recurringTemplate.create({
        title: flags.title,
        categoryId,
        description: flags.desc,
        link: flags.link,
        externalContact: flags.contact,
        recurrenceType: flags.recurrence as RecurrenceType,
        dayOfWeek: flags.dayOfWeek ? Number(flags.dayOfWeek) : undefined,
        dayOfMonth: flags.dayOfMonth ? Number(flags.dayOfMonth) : undefined,
      });
      console.log(`Created template ${template.id}: ${template.title}`);
      break;
    }

    case "template:delete": {
      await caller.recurringTemplate.delete({ templateId: positional[0] });
      console.log(`Deleted template ${positional[0]}`);
      break;
    }

    default:
      console.log(
        [
          "Usage: pnpm momentum <command> [args]",
          "",
          "  categories",
          "  category:create --name N [--color #RRGGBB]",
          "  tasks [--status S] [--search S]",
          "  task <taskId>",
          "  task:create --title T --category NAME_OR_ID [--due YYYY-MM-DD] [--desc D] [--link L] [--contact C]",
          "  task:status <taskId> <STATUS>",
          "  task:complete <taskId>",
          "  task:snooze <taskId> <days>",
          "  task:delete <taskId>",
          "  templates",
          "  template:create --title T --category NAME_OR_ID --recurrence DAILY|WEEKLY|MONTHLY [--dayOfWeek N] [--dayOfMonth N]",
          "  template:delete <templateId>",
        ].join("\n"),
      );
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
