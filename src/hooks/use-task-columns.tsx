import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { type Task } from "@/generated/prisma/client";
import { TaskStatus } from "@/generated/prisma/enums";
import { parseTaskStatus } from "@/lib/task-utils";
import { trpc } from "@/trpc/client";
import type { ColumnDef } from "@tanstack/react-table";
import { format, isAfter, isBefore } from "date-fns";
import { ArrowUpDownIcon, MoreHorizontalIcon } from "lucide-react";
import { useMemo } from "react";
import { toast } from "sonner";

export function useTaskColumns() {
  const trpcUtils = trpc.useUtils();
  const { mutate: snoozeTask } = trpc.task.snooze.useMutation({
    onSuccess: (_data, variables) => {
      toast.success(`Snoozed task by ${variables.days} day(s)`);
      trpcUtils.task.getAllTasks.invalidate();
    },
  });

  return useMemo<ColumnDef<Task>[]>(
    () => [
      {
        accessorKey: "title",
        header: ({ column }) => (
          <Button variant={"ghost"} onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            Title
            <ArrowUpDownIcon className="ml-2 size-4" />
          </Button>
        ),
      },
      {
        accessorKey: "dueDate",
        header: ({ column }) => (
          <Button variant={"ghost"} onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            Due Date
            <ArrowUpDownIcon className="ml-2 size-4" />
          </Button>
        ),
        cell: ({ row }) => (row.original.dueDate ? format(row.original.dueDate, "yyyy-MM-dd") : ""),
      },
      {
        accessorKey: "status",
        header: ({ column }) => (
          <Button variant={"ghost"} onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            Status
            <ArrowUpDownIcon className="ml-2 size-4" />
          </Button>
        ),
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
      {
        id: "actions",
        cell: ({ row }) => {
          const task = row.original;

          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant={"ghost"} className="size-8 p-0">
                  <span className="sr-only">Open menu</span>
                  <MoreHorizontalIcon className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Snooze</DropdownMenuLabel>
                <DropdownMenuGroup>
                  <DropdownMenuItem onClick={() => snoozeTask({ taskId: task.id, days: 1 })}>1 day</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => snoozeTask({ taskId: task.id, days: 3 })}>3 days</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => snoozeTask({ taskId: task.id, days: 7 })}>7 days</DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    [snoozeTask],
  );
}
