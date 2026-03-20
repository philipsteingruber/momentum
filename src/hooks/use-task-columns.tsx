import { StatusBadge } from "@/_components/status-badge";
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
import { useFormatInUserTz } from "@/hooks/use-format-in-user-tz";
import { SNOOZE_OPTIONS } from "@/lib/task-utils";
import { trpc } from "@/trpc/client";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDownIcon, MoreHorizontalIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { toast } from "sonner";

export function useTaskColumns() {
  const t = useTranslations("TaskColumns");
  const trpcUtils = trpc.useUtils();
  const { fmtRelative } = useFormatInUserTz();
  const { mutate: snoozeTask } = trpc.task.snooze.useMutation({
    onSuccess: (_data, variables) => {
      toast.success(t("snoozedToast", { days: variables.days }));
      trpcUtils.task.getAll.invalidate();
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
            aria-label={t("selectAll")}
          />
        ),
        cell: ({ row }) => (
          <div onClick={(e) => e.stopPropagation()}>
            <Checkbox
              checked={row.getIsSelected()}
              onCheckedChange={(value) => row.toggleSelected(!!value)}
              aria-label={t("selectRow")}
            />
          </div>
        ),
        enableSorting: false,
      },
      {
        accessorKey: "title",
        header: ({ column }) => (
          <Button variant={"ghost"} onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            {t("titleHeader")}
            <ArrowUpDownIcon className="ml-2 size-4" />
          </Button>
        ),
      },
      {
        accessorKey: "dueDate",
        header: ({ column }) => (
          <Button variant={"ghost"} onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            {t("dueDateHeader")}
            <ArrowUpDownIcon className="ml-2 size-4" />
          </Button>
        ),
        cell: ({ row }) => (row.original.dueDate ? fmtRelative(row.original.dueDate) : ""),
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
        header: t("createdHeader"),
        cell: ({ row }) => fmtRelative(row.original.createdAt),
        sortingFn: (rowA, rowB) => {
          const a = rowA.original.createdAt;
          const b = rowB.original.createdAt;
          return a.getTime() - b.getTime();
        },
      },
      {
        accessorKey: "updatedAt",
        header: t("updatedHeader"),
        cell: ({ row }) => fmtRelative(row.original.updatedAt),
        sortingFn: (rowA, rowB) => {
          const a = rowA.original.updatedAt;
          const b = rowB.original.updatedAt;
          return a.getTime() - b.getTime();
        },
      },
      {
        accessorKey: "status",
        header: ({ column }) => (
          <Button variant={"ghost"} onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            {t("statusHeader")}
            <ArrowUpDownIcon className="ml-2 size-4" />
          </Button>
        ),
        cell: ({ row }) => <StatusBadge task={row.original} />,
      },
      {
        id: "actions",
        cell: ({ row }) => {
          const task = row.original;
          const snoozeLabels: Record<typeof SNOOZE_OPTIONS[number], string> = {
            1: t("snooze1Day"),
            3: t("snooze3Days"),
            7: t("snooze7Days"),
          };

          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant={"ghost"} className="size-8 p-0">
                  <span className="sr-only">{t("openMenu")}</span>
                  <MoreHorizontalIcon className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>{t("snoozeLabel")}</DropdownMenuLabel>
                <DropdownMenuGroup>
                  {SNOOZE_OPTIONS.map((days) => (
                    <DropdownMenuItem key={days} onClick={() => snoozeTask({ taskId: task.id, days })}>
                      {snoozeLabels[days]}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    [snoozeTask, fmtRelative, t],
  );
}
