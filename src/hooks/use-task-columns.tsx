import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { formatRelative, isAfter, isBefore } from "date-fns";
import { enUS } from "date-fns/locale";
import { ArrowUpDownIcon, MoreHorizontalIcon } from "lucide-react";
import { useMemo } from "react";
import { toast } from "sonner";

const dateOnlyRelativeLocale = {
  lastWeek: "'last' eeee",
  yesterday: "'yesterday'",
  today: "'today'",
  tomorrow: "'tomorrow'",
  nextWeek: "eeee",
  other: "MM/dd/yyyy",
} as const;

const dateOnlyLocale = {
  ...enUS,
  formatRelative: (token: keyof typeof dateOnlyRelativeLocale) => dateOnlyRelativeLocale[token],
};

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
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
            aria-label="Select all"
          />
        ),
        cell: ({ row }) => (
          <div onClick={(e) => e.stopPropagation()}>
            <Checkbox
              checked={row.getIsSelected()}
              onCheckedChange={(value) => row.toggleSelected(!!value)}
              aria-label="Select row"
            />
          </div>
        ),
        enableSorting: false,
      },
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
        cell: ({ row }) =>
          row.original.dueDate
            ? formatRelative(row.original.dueDate, new Date(), { locale: dateOnlyLocale, weekStartsOn: 1 })
            : "",
        sortingFn: (rowA, rowB) => {
          const a = rowA.original.dueDate;
          const b = rowB.original.dueDate;
          if (!a && !b) return 0;
          if (!a) return 1;
          if (!b) return -1;
          return a.getTime() - b.getTime();
        },
      },
      {
        accessorKey: "createdAt",
        header: "Created",
        cell: ({ row }) =>
          formatRelative(row.original.createdAt, new Date(), { locale: dateOnlyLocale, weekStartsOn: 1 }),
        sortingFn: (rowA, rowB) => {
          const a = rowA.original.createdAt;
          const b = rowB.original.createdAt;
          return a.getTime() - b.getTime();
        },
      },
      {
        accessorKey: "updatedAt",
        header: "Updated",
        cell: ({ row }) => formatRelative(row.original.updatedAt, new Date(), { weekStartsOn: 1 }),
        sortingFn: (rowA, rowB) => {
          const a = rowA.original.createdAt;
          const b = rowB.original.createdAt;
          return a.getTime() - b.getTime();
        },
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
            {row.original.dueDate &&
            isBefore(row.original.dueDate, new Date()) &&
            row.original.status !== TaskStatus.COMPLETED
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
