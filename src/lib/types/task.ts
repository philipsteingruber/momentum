import type { Tag, Task } from "@/generated/prisma/client";

export type TaskWithTags = Task & { tags: Tag[] };
