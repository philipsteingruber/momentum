"use client";

import { Badge } from "@/components/ui/badge";
import type { Task } from "@/generated/prisma/client";
import { TaskStatus } from "@/generated/prisma/enums";
import { isOverdue } from "@/lib/task-utils";
import { useTranslations } from "next-intl";

export const StatusBadge = ({ task }: { task: Task }) => {
  const tStatus = useTranslations("TaskStatus");

  return (
    <Badge
      variant={
        task.status === TaskStatus.COMPLETED
          ? "completed"
          : task.status === TaskStatus.CANCELLED
            ? "cancelled"
            : task.status === TaskStatus.BLOCKED || isOverdue(task.dueDate)
              ? "warn"
              : "in_progress"
      }
    >
      {isOverdue(task.dueDate) && task.status !== TaskStatus.COMPLETED
        ? tStatus("OVERDUE")
        : tStatus(task.status)}
    </Badge>
  );
};
