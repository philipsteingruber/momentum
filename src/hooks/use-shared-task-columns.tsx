import { StatusBadge } from "@/_components/status-badge";
import { Button } from "@/components/ui/button";
import { type Task } from "@/generated/prisma/client";
import { useFormatInUserTz } from "@/hooks/use-format-in-user-tz";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDownIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo } from "react";

export function useSharedTaskColumns() {
  const t = useTranslations("TaskColumns");
  const { fmtRelative } = useFormatInUserTz();

  return useMemo<ColumnDef<Task>[]>(
    () => [
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
    ],
    [fmtRelative, t],
  );
}
