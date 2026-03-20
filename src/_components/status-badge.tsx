"use client";

import { Badge } from "@/components/ui/badge";
import type { Task } from "@/generated/prisma/client";
import { TaskStatus } from "@/generated/prisma/enums";
import { useFormatInUserTz } from "@/hooks/use-format-in-user-tz";
import { useTranslations } from "next-intl";

export const StatusBadge = ({ task }: { task: Task }) => {
  const tStatus = useTranslations("TaskStatus");
  const { isOverdue } = useFormatInUserTz();
  const overdue = task.dueDate ? isOverdue(task.dueDate) : false;

  return (
    <Badge
      variant={
        task.status === TaskStatus.COMPLETED
          ? "completed"
          : task.status === TaskStatus.CANCELLED
            ? "cancelled"
            : task.status === TaskStatus.BLOCKED || overdue
              ? "warn"
              : "in_progress"
      }
    >
      {overdue && task.status !== TaskStatus.COMPLETED && task.status !== TaskStatus.CANCELLED ? tStatus("OVERDUE") : tStatus(task.status)}
    </Badge>
  );
};
