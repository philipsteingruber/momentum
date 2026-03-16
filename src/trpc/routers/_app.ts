import { createTRPCRouter } from "../init";
import { categoryRouter } from "./category";
import { noteRouter } from "./note";
import { recurringTemplateRouter } from "./recurringTemplate";
import { tagRouter } from "./tag";
import { taskRouter } from "./task";

export const appRouter = createTRPCRouter({
  category: categoryRouter,
  note: noteRouter,
  recurringTemplate: recurringTemplateRouter,
  tag: tagRouter,
  task: taskRouter,
});

export type AppRouter = typeof appRouter;
