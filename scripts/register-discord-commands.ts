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
];

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_BOT_TOKEN!);

const main = async (): Promise<void> => {
  console.log("Registering slash commands...");
  await rest.put(Routes.applicationCommands(process.env.DISCORD_CLIENT_ID!), { body: commands });
  console.log("Done. Global commands propagate in ~1 hour.");
};

main().catch(console.error);
