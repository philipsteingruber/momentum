import type { Tag, Task } from "@/generated/prisma/client";

export type TaskWithSessionInfo = Task & { recurringTemplate?: { timesPerCycle: number } | null };

export type TaskWithTags = TaskWithSessionInfo & { tags: Tag[] };
