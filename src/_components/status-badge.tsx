import { Badge } from "@/components/ui/badge";
import type { Task } from "@/generated/prisma/client";
import { TaskStatus } from "@/generated/prisma/enums";
import { isOverdue, parseTaskStatus } from "@/lib/task-utils";

export const StatusBadge = ({ task }: { task: Task }) => {
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
      {isOverdue(task.dueDate) && task.status !== TaskStatus.COMPLETED ? "Overdue" : parseTaskStatus(task.status)}
    </Badge>
  );
};
