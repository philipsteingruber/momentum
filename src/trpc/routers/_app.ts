import { createTRPCRouter } from "../init";
import { categoryRouter } from "./category";
import { cronLogRouter } from "./cron-log";
import { noteRouter } from "./note";
import { recurringTemplateRouter } from "./recurringTemplate";
import { tagRouter } from "./tag";
import { taskRouter } from "./task";
import { userSettingsRouter } from "./user-settings";

export const appRouter = createTRPCRouter({
  category: categoryRouter,
  cronLog: cronLogRouter,
  note: noteRouter,
  recurringTemplate: recurringTemplateRouter,
  tag: tagRouter,
  task: taskRouter,
  userSettings: userSettingsRouter,
});

export type AppRouter = typeof appRouter;
