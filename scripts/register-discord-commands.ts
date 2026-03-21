import { REST } from "@discordjs/rest";
import type { RESTPostAPIApplicationCommandsJSONBody } from "discord-api-types/v10";
import { ApplicationCommandOptionType, Routes } from "discord-api-types/v10";
import { config } from "dotenv";

config({ path: ".env" });

const commands: RESTPostAPIApplicationCommandsJSONBody[] = [
  {
    name: "list",
    description: "List your tasks",
    options: [
      {
        name: "status",
        description: "Filter by task status",
        type: ApplicationCommandOptionType.String,
        required: false,
        choices: [
          { name: "Pending", value: "PENDING" },
          { name: "In Progress", value: "IN_PROGRESS" },
          { name: "Blocked", value: "BLOCKED" },
          { name: "Completed", value: "COMPLETED" },
          { name: "Cancelled", value: "CANCELLED" },
        ],
      },
    ],
  },
  {
    name: "today",
    description: "List tasks due today or overdue",
  },
  {
    name: "add",
    description: "Create a new task",
    options: [
      {
        name: "title",
        description: "Task title",
        type: ApplicationCommandOptionType.String,
        required: true,
      },
      {
        name: "due",
        description: "Due date (YYYY-MM-DD)",
        type: ApplicationCommandOptionType.String,
        required: false,
      },
      {
        name: "category",
        description: "Category",
        type: ApplicationCommandOptionType.String,
        required: false,
        autocomplete: true,
      },
    ],
  },
  {
    name: "complete",
    description: "Mark a task as completed",
    options: [
      {
        name: "task_id",
        description: "The task to complete",
        type: ApplicationCommandOptionType.String,
        required: true,
        autocomplete: true,
      },
    ],
  },
  {
    name: "snooze",
    description: "Extend a task's due date",
    options: [
      {
        name: "task",
        description: "The task to snooze",
        type: ApplicationCommandOptionType.String,
        required: true,
        autocomplete: true,
      },
      {
        name: "days",
        description: "Number of days to extend (1–7)",
        type: ApplicationCommandOptionType.Integer,
        required: true,
        min_value: 1,
        max_value: 7,
      },
    ],
  },
  {
    name: "note",
    description: "Add a note to a task",
    options: [
      {
        name: "task",
        description: "The task to add a note to",
        type: ApplicationCommandOptionType.String,
        required: true,
        autocomplete: true,
      },
      {
        name: "content",
        description: "Note content",
        type: ApplicationCommandOptionType.String,
        required: true,
      },
    ],
  },
];

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_BOT_TOKEN!);

const main = async (): Promise<void> => {
  console.log("Registering slash commands...");
  await rest.put(Routes.applicationCommands(process.env.DISCORD_CLIENT_ID!), { body: commands });
  console.log("Done. Global commands propagate in ~1 hour.");
};

main().catch(console.error);
