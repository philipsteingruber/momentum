import { RecurrenceType, TaskStatus } from "@/generated/prisma/enums";
import { computeSnoozeDueDate, endOfDayInTz } from "@/lib/date-utils";
import { followUpInteraction, formatDigestEmbeds } from "@/lib/discord";
import { prisma } from "@/lib/prisma";
import { groupTasksForDigest } from "@/lib/task-utils";
import {
  InteractionResponseType,
  InteractionType,
  type APIApplicationCommandAutocompleteInteraction,
  type APIApplicationCommandInteractionDataIntegerOption,
  type APIApplicationCommandInteractionDataStringOption,
  type APIChatInputApplicationCommandInteraction,
  type APIInteraction,
} from "discord-api-types/v10";
import { addDays, startOfDay } from "date-fns";
import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";
import { after } from "next/server";
import nacl from "tweetnacl";

const APPLICATION_ID = process.env.DISCORD_CLIENT_ID!;
const BASE_URL = (process.env.NEXT_PUBLIC_BASE_URL ?? "").replace(/\/$/, "");

const getOptions = (
  interaction: APIChatInputApplicationCommandInteraction,
): APIApplicationCommandInteractionDataStringOption[] | undefined =>
  interaction.data.options as APIApplicationCommandInteractionDataStringOption[] | undefined;

const verifySignature = (rawBody: string, signature: string, timestamp: string): boolean => {
  try {
    return nacl.sign.detached.verify(
      Buffer.from(timestamp + rawBody),
      Buffer.from(signature, "hex"),
      Buffer.from(process.env.DISCORD_PUBLIC_KEY!, "hex"),
    );
  } catch {
    return false;
  }
};

const handleList = async (
  interaction: APIChatInputApplicationCommandInteraction,
  token: string,
  userId: string,
  timezone: string,
): Promise<void> => {
  const options = getOptions(interaction);
  const statusOption = options?.find((o) => o.name === "status")?.value;

  const tasks = await prisma.task.findMany({
    where: {
      userId,
      status: statusOption
        ? (statusOption as TaskStatus)
        : { notIn: [TaskStatus.COMPLETED, TaskStatus.CANCELLED, TaskStatus.SKIPPED] },
    },
    take: 50,
  });

  if (tasks.length === 0) {
    await followUpInteraction(APPLICATION_ID, token, {
      content: statusOption ? `No tasks with status \`${statusOption}\`.` : "No active tasks found.",
    });
    return;
  }

  const description = tasks
    .map((task) => {
      const due = task.dueDate ? ` - due ${formatInTimeZone(task.dueDate, timezone, "yyyy-MM-dd")}` : "";
      const status = `\`${task.status.toLowerCase()}\``;
      return `**[${task.title}](${BASE_URL}/task/${task.id})** ${status}${due}`;
    })
    .join("\n");

  await followUpInteraction(APPLICATION_ID, token, {
    embeds: [
      {
        title: `Tasks (${tasks.length >= 20 ? `${tasks.length}+` : tasks.length})`,
        description,
        color: 0x6366f1,
      },
    ],
  });
};

const handleComplete = async (
  interaction: APIChatInputApplicationCommandInteraction,
  token: string,
  userId: string,
): Promise<void> => {
  const options = getOptions(interaction);
  const taskId = options?.find((o) => o.name === "task_id")?.value;

  if (!taskId) {
    await followUpInteraction(APPLICATION_ID, token, {
      content: "Missing `task_id`. Usage: `/complete task_id:<id>`",
    });
    return;
  }

  const task = await prisma.task.findFirst({ where: { id: taskId, userId } });

  if (!task) {
    await followUpInteraction(APPLICATION_ID, token, {
      content: `Task \`${taskId}\` doesn't exist or you don't have permission.`,
    });
    return;
  }

  if (task.status === TaskStatus.COMPLETED) {
    await followUpInteraction(APPLICATION_ID, token, {
      content: `Task **${task.title}** is already completed.`,
    });
    return;
  }

  await prisma.task.update({
    where: { id: taskId },
    data: { status: TaskStatus.COMPLETED, completedAt: new Date() },
  });

  await followUpInteraction(APPLICATION_ID, token, {
    embeds: [
      {
        description: `✅ Completed: **${task.title}**`,
        color: 0x22c55e,
      },
    ],
  });
};

const autocompleteEmpty = (): Response =>
  Response.json({
    type: InteractionResponseType.ApplicationCommandAutocompleteResult,
    data: { choices: [] },
  });

const handleAutocomplete = async (
  interaction: APIApplicationCommandAutocompleteInteraction,
): Promise<Response> => {
  const discordUserId = interaction.member?.user.id ?? interaction.user?.id;
  if (!discordUserId) return autocompleteEmpty();

  const settings = await prisma.userSettings.findUnique({
    where: { discordId: discordUserId },
    include: { user: true },
  });
  if (!settings) return autocompleteEmpty();

  const focusedOption = interaction.data.options?.find(
    (o): o is APIApplicationCommandInteractionDataStringOption =>
      "focused" in o && o.focused === true,
  );
  if (!focusedOption) return autocompleteEmpty();

  const query = focusedOption.value ?? "";
  const userId = settings.user.id;

  if (focusedOption.name === "category") {
    const categories = await prisma.category.findMany({
      where: {
        userId,
        ...(query ? { name: { contains: query, mode: "insensitive" } } : {}),
      },
      take: 25,
      orderBy: { name: "asc" },
    });

    return Response.json({
      type: InteractionResponseType.ApplicationCommandAutocompleteResult,
      data: {
        choices: categories.map((c) => ({ name: c.name, value: c.id })),
      },
    });
  }

  // task_id (for /complete) and task (for /note, /snooze)
  const tasks = await prisma.task.findMany({
    where: {
      userId,
      status: { notIn: [TaskStatus.COMPLETED, TaskStatus.CANCELLED, TaskStatus.SKIPPED] },
      ...(query ? { title: { contains: query, mode: "insensitive" } } : {}),
    },
    take: 25,
    orderBy: { createdAt: "desc" },
  });

  return Response.json({
    type: InteractionResponseType.ApplicationCommandAutocompleteResult,
    data: {
      choices: tasks.map((task) => ({
        name: task.title.length > 100 ? task.title.slice(0, 97) + "..." : task.title,
        value: task.id,
      })),
    },
  });
};

const handleToday = async (
  interaction: APIChatInputApplicationCommandInteraction,
  token: string,
  userId: string,
  timezone: string,
): Promise<void> => {
  const now = new Date();
  const zonedNow = toZonedTime(now, timezone);
  const endOfToday = endOfDayInTz(now, timezone);
  const startOfToday = fromZonedTime(startOfDay(zonedNow), timezone);

  const tasks = await prisma.task.findMany({
    where: {
      userId,
      dueDate: { lte: endOfToday },
      status: { notIn: [TaskStatus.COMPLETED, TaskStatus.CANCELLED, TaskStatus.SKIPPED] },
    },
    orderBy: { dueDate: "asc" },
    take: 50,
  });

  if (tasks.length === 0) {
    await followUpInteraction(APPLICATION_ID, token, {
      content: "No tasks due today or overdue.",
    });
    return;
  }

  const description = tasks
    .map((task) => {
      const due = task.dueDate!;
      const isOverdue = due < startOfToday;
      const label = isOverdue
        ? `overdue ${formatInTimeZone(due, timezone, "yyyy-MM-dd")}`
        : "today";
      return `**[${task.title}](${BASE_URL}/task/${task.id})** \`${label}\``;
    })
    .join("\n");

  await followUpInteraction(APPLICATION_ID, token, {
    embeds: [
      {
        title: `Due today or overdue (${tasks.length})`,
        description,
        color: 0xef4444,
      },
    ],
  });
};

const handleAdd = async (
  interaction: APIChatInputApplicationCommandInteraction,
  token: string,
  userId: string,
  timezone: string,
): Promise<void> => {
  const options = getOptions(interaction);
  const title = options?.find((o) => o.name === "title")?.value;
  const dueRaw = options?.find((o) => o.name === "due")?.value;
  const categoryId = options?.find((o) => o.name === "category")?.value;

  if (!title) {
    await followUpInteraction(APPLICATION_ID, token, {
      content: "Missing `title`.",
    });
    return;
  }

  if (!categoryId) {
    await followUpInteraction(APPLICATION_ID, token, {
      content: "Missing `category`.",
    });
    return;
  }

  let dueDate: Date | undefined;
  if (dueRaw) {
    const parts = dueRaw.split("-").map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) {
      await followUpInteraction(APPLICATION_ID, token, {
        content: "Invalid date format. Use `YYYY-MM-DD`, e.g. `2026-03-28`.",
      });
      return;
    }
    // Interpret the date as midnight in the user's configured timezone
    dueDate = fromZonedTime(`${dueRaw}T00:00:00`, timezone);
  }

  const task = await prisma.task.create({
    data: {
      title,
      userId,
      ...(dueDate ? { dueDate } : {}),
      ...(categoryId ? { categoryId } : {}),
    },
  });

  const dueLine = dueDate ? ` — due ${formatInTimeZone(dueDate, timezone, "yyyy-MM-dd")}` : "";

  await followUpInteraction(APPLICATION_ID, token, {
    embeds: [
      {
        description: `✅ Created: **[${task.title}](${BASE_URL}/task/${task.id})**` + dueLine,
        color: 0x6366f1,
      },
    ],
  });
};

const handleSnooze = async (
  interaction: APIChatInputApplicationCommandInteraction,
  token: string,
  userId: string,
  timezone: string,
): Promise<void> => {
  const stringOptions = getOptions(interaction);
  const taskId = stringOptions?.find((o) => o.name === "task")?.value;
  const daysOption = interaction.data.options?.find(
    (o): o is APIApplicationCommandInteractionDataIntegerOption => o.name === "days",
  );
  const days = daysOption?.value;

  if (!taskId || days === undefined) {
    await followUpInteraction(APPLICATION_ID, token, {
      content: "Missing required options.",
    });
    return;
  }

  const task = await prisma.task.findFirst({
    where: { id: taskId, userId },
    include: { recurringTemplate: { select: { recurrenceType: true } } },
  });
  if (!task) {
    await followUpInteraction(APPLICATION_ID, token, {
      content: "Task not found or you don't have permission.",
    });
    return;
  }

  if (!task.dueDate) {
    await followUpInteraction(APPLICATION_ID, token, {
      content: "This task has no due date and cannot be snoozed.",
    });
    return;
  }

  if (task.recurringTemplate?.recurrenceType === RecurrenceType.DAILY) {
    await followUpInteraction(APPLICATION_ID, token, {
      content: "Daily recurring tasks cannot be snoozed.",
    });
    return;
  }

  const newDue = computeSnoozeDueDate(task.dueDate, Number(days), timezone);

  if (task.recurringTemplateId) {
    await prisma.$transaction(async (tx) => {
      await tx.task.update({ where: { id: taskId }, data: { dueDate: newDue } });
      await tx.recurringTemplate.update({
        where: { id: task.recurringTemplateId! },
        data: { snoozeCount: { increment: 1 }, nextGenerateOn: addDays(newDue, 1) },
      });
    });
  } else {
    await prisma.task.update({ where: { id: taskId }, data: { dueDate: newDue } });
  }

  await followUpInteraction(APPLICATION_ID, token, {
    embeds: [
      {
        description: `⏰ Snoozed: **${task.title}** — now due ${formatInTimeZone(newDue, timezone, "yyyy-MM-dd")}`,
        color: 0xf59e0b,
      },
    ],
  });
};

const handleNote = async (
  interaction: APIChatInputApplicationCommandInteraction,
  token: string,
  userId: string,
): Promise<void> => {
  const options = getOptions(interaction);
  const taskId = options?.find((o) => o.name === "task")?.value;
  const content = options?.find((o) => o.name === "content")?.value;

  if (!taskId || !content) {
    await followUpInteraction(APPLICATION_ID, token, {
      content: "Missing required options.",
    });
    return;
  }

  const task = await prisma.task.findFirst({ where: { id: taskId, userId } });
  if (!task) {
    await followUpInteraction(APPLICATION_ID, token, {
      content: "Task not found or you don't have permission.",
    });
    return;
  }

  await prisma.note.create({ data: { taskId, content } });

  await followUpInteraction(APPLICATION_ID, token, {
    embeds: [
      {
        description: `📝 Note added to **[${task.title}](${BASE_URL}/task/${task.id})**\n> ${content}`,
        color: 0x6366f1,
      },
    ],
  });
};

const handleDigest = async (
  token: string,
  userId: string,
  timezone: string,
): Promise<void> => {
  const tasks = await prisma.task.findMany({
    where: { userId, dueDate: { not: null } },
    include: { recurringTemplate: { select: { recurrenceType: true } } },
    orderBy: { dueDate: "asc" },
  });

  const dailyRecurring = tasks.filter(
    (t) =>
      t.recurringTemplate?.recurrenceType === RecurrenceType.DAILY &&
      t.status !== TaskStatus.CANCELLED &&
      t.status !== TaskStatus.COMPLETED &&
      t.status !== TaskStatus.SKIPPED,
  );
  const otherTasks = tasks.filter((t) => t.recurringTemplate?.recurrenceType !== RecurrenceType.DAILY);

  const { overdue, dueToday, dueThisWeek } = groupTasksForDigest(otherTasks, timezone);
  const groups = { overdue, dueToday, dueThisWeek, dailyRecurring };
  const embeds = formatDigestEmbeds(groups, timezone);

  await followUpInteraction(APPLICATION_ID, token, { embeds });
};

const handleCommand = async (interaction: APIChatInputApplicationCommandInteraction): Promise<void> => {
  const token = interaction.token;

  const discordUserId = interaction.member?.user.id ?? interaction.user?.id;
  if (!discordUserId) {
    await followUpInteraction(APPLICATION_ID, token, {
      content: "Could not identify your Discord account.",
    });
    return;
  }

  const settings = await prisma.userSettings.findUnique({
    where: { discordId: discordUserId },
    include: { user: true },
  });

  if (!settings) {
    await followUpInteraction(APPLICATION_ID, token, {
      content: `Your Discord account is not linked to a Momentum account. Visit ${BASE_URL}/settings/discord to connect.`,
    });
    return;
  }

  const timezone = settings.timezone;
  const commandName = interaction.data.name;

  if (commandName === "list") {
    await handleList(interaction, token, settings.user.id, timezone);
  } else if (commandName === "today") {
    await handleToday(interaction, token, settings.user.id, timezone);
  } else if (commandName === "add") {
    await handleAdd(interaction, token, settings.user.id, timezone);
  } else if (commandName === "complete") {
    await handleComplete(interaction, token, settings.user.id);
  } else if (commandName === "snooze") {
    await handleSnooze(interaction, token, settings.user.id, timezone);
  } else if (commandName === "note") {
    await handleNote(interaction, token, settings.user.id);
  } else if (commandName === "digest") {
    await handleDigest(token, settings.user.id, timezone);
  } else {
    await followUpInteraction(APPLICATION_ID, token, {
      content: `Unknown command: \`${commandName}\``,
    });
  }
};

export const POST = async (req: Request): Promise<Response> => {
  const rawBody = await req.text();
  const signature = req.headers.get("x-signature-ed25519");
  const timestamp = req.headers.get("x-signature-timestamp");

  if (!signature || !timestamp || !verifySignature(rawBody, signature, timestamp)) {
    return new Response("Invalid signature", { status: 401 });
  }

  const interaction = JSON.parse(rawBody) as APIInteraction;

  if (interaction.type === InteractionType.Ping) {
    return Response.json({ type: InteractionResponseType.Pong });
  }

  if (interaction.type === InteractionType.ApplicationCommandAutocomplete) {
    return handleAutocomplete(interaction as APIApplicationCommandAutocompleteInteraction);
  }

  if (interaction.type === InteractionType.ApplicationCommand) {
    after(async () => {
      await handleCommand(interaction as APIChatInputApplicationCommandInteraction);
    });

    return Response.json({ type: InteractionResponseType.DeferredChannelMessageWithSource });
  }

  return new Response("Unknown interaction type", { status: 400 });
};
