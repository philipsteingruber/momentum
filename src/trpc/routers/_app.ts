import { createTRPCRouter } from "../init";
import { categoryRouter } from "./category";
import { noteRouter } from "./note";
import { tagRouter } from "./tag";
import { taskRouter } from "./task";

export const appRouter = createTRPCRouter({
  category: categoryRouter,
  note: noteRouter,
  tag: tagRouter,
  task: taskRouter,
});

export type AppRouter = typeof appRouter;
