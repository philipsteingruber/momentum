import { Badge } from "@/components/ui/badge";
import { type Task } from "@/generated/prisma/client";
import { TaskStatus } from "@/generated/prisma/enums";
import { parseTaskStatus } from "@/lib/task-utils";
import type { ColumnDef } from "@tanstack/react-table";
import { format, isAfter, isBefore } from "date-fns";

export const columns: ColumnDef<Task>[] = [
  {
    accessorKey: "title",
    header: "Title",
  },
  {
    accessorKey: "dueDate",
    header: "Due Date",
    cell: ({ row }) => (row.original.dueDate ? format(row.original.dueDate, "yyyy-MM-dd") : ""),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <Badge
        variant={
          row.original.status === TaskStatus.BLOCKED ||
          (row.original.dueDate && isAfter(new Date(), row.original.dueDate))
            ? "warn"
            : row.original.status === TaskStatus.COMPLETED
              ? "completed"
              : row.original.status === TaskStatus.CANCELLED
                ? "cancelled"
                : "in_progress"
        }
      >
        {row.original.dueDate && isBefore(row.original.dueDate, new Date())
          ? "Overdue"
          : parseTaskStatus(row.original.status)}
      </Badge>
    ),
  },
];
