import { REST } from "@discordjs/rest";
import { differenceInCalendarDays, format, startOfDay } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import type {
  APIEmbed,
  RESTPostAPIChannelMessageJSONBody,
  RESTPostAPIWebhookWithTokenJSONBody,
} from "discord-api-types/v10";
import { Routes } from "discord-api-types/v10";
import type { DigestTaskGroups } from "./task-utils";

export const discordRest = new REST({ version: "10" }).setToken(process.env.DISCORD_BOT_TOKEN!);

export const openDmChannel = async (discordUserId: string): Promise<string> => {
  const channel = (await discordRest.post(Routes.userChannels(), {
    body: { recipient_id: discordUserId },
  })) as { id: string };
  return channel.id;
};

export const sendDmToChannel = async (channelId: string, payload: RESTPostAPIChannelMessageJSONBody): Promise<void> => {
  await discordRest.post(Routes.channelMessages(channelId), { body: payload });
};

export const followUpInteraction = async (
  applicationId: string,
  interactionToken: string,
  payload: RESTPostAPIWebhookWithTokenJSONBody,
): Promise<void> => {
  await discordRest.patch(Routes.webhookMessage(applicationId, interactionToken), { body: payload });
};

export const formatDigestEmbeds = (groups: DigestTaskGroups, timezone: string): APIEmbed[] => {
  const { overdue, dueToday, dueThisWeek, dailyRecurring } = groups;
  const embeds: APIEmbed[] = [];
  const today = startOfDay(toZonedTime(new Date(), timezone));
  const baseUrl = (process.env.NEXT_PUBLIC_BASE_URL ?? "").trim().replace(/\/$/, "");

  const taskLink = (task: { id: string; title: string }) =>
    `[**${task.title}**](${baseUrl}/task/${task.id})`;

  if (overdue.length > 0) {
    embeds.push({
      title: `🔴 Overdue (${overdue.length})`,
      color: 0xef4444,
      description: overdue
        .map((task) => {
          const daysAgo = differenceInCalendarDays(today, startOfDay(toZonedTime(task.dueDate!, timezone)));
          return `${taskLink(task)} - ${daysAgo} day${daysAgo !== 1 ? "s" : ""} overdue`;
        })
        .join("\n"),
    });
  }

  if (dueToday.length > 0) {
    embeds.push({
      title: `🔵 Due Today (${dueToday.length})`,
      color: 0x6366f1,
      description: dueToday.map(taskLink).join("\n"),
    });
  }

  if (dailyRecurring.length > 0) {
    embeds.push({
      title: `🟡 Daily Tasks (${dailyRecurring.length})`,
      color: 0xf59e0b,
      description: dailyRecurring.map(taskLink).join("\n"),
    });
  }

  for (const group of dueThisWeek) {
    embeds.push({
      title: format(group.date, "EEEE, MMM d"),
      color: 0x6b7280,
      description: group.tasks.map(taskLink).join("\n"),
    });
  }

  if (embeds.length === 0) {
    embeds.push({
      description: "Nothing due this week. Keep it up!",
      color: 0x22c55e,
    });
  }

  return embeds;
};
