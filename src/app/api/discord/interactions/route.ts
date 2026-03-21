import { TaskStatus } from "@/generated/prisma/enums";
import { followUpInteraction } from "@/lib/discord";
import { prisma } from "@/lib/prisma";
import {
  InteractionResponseType,
  InteractionType,
  type APIApplicationCommandInteractionDataStringOption,
  type APIChatInputApplicationCommandInteraction,
  type APIInteraction,
} from "discord-api-types/v10";
import { after } from "next/server";
import nacl from "tweetnacl";

const APPLICATION_ID = process.env.DISCORD_CLIENT_ID!;
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "";

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
      const due = task.dueDate ? ` - due ${task.dueDate.toLocaleDateString()}` : "";
      const status = `\`${task.status.toLowerCase()}\``;
      return `**[${task.title}](${BASE_URL}/task/${task.id})** ${status}${due}`;
    })
    .join("\n");

  await followUpInteraction(APPLICATION_ID, token, {
    embeds: [
      {
        title: `Tasks (${tasks.length}${tasks.length >= 20 ? "+" : ""})`,
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

  const commandName = interaction.data.name;

  if (commandName === "list") {
    await handleList(interaction, token, settings.user.id);
  } else if (commandName === "complete") {
    await handleComplete(interaction, token, settings.user.id);
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

  if (interaction.type === InteractionType.ApplicationCommand) {
    after(async () => {
      await handleCommand(interaction as APIChatInputApplicationCommandInteraction);
    });

    return Response.json({ type: InteractionResponseType.DeferredChannelMessageWithSource });
  }

  return new Response("Unknown interaction type", { status: 400 });
};
