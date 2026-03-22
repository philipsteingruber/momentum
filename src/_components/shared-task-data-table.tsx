"use client";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Task } from "@/generated/prisma/client";
import { TaskStatus } from "@/generated/prisma/enums";
import { useFormatInUserTz } from "@/hooks/use-format-in-user-tz";
import { cn } from "@/lib/utils";
import type { SortingState } from "@tanstack/react-table";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface SharedDataTableProps {
  columns: ColumnDef<Task, unknown>[];
  data: Task[];
  isPending: boolean;
  grantorId: string;
}

export const SharedTaskDataTable = ({ columns, data, isPending, grantorId }: SharedDataTableProps) => {
  const router = useRouter();
  const t = useTranslations("DataTable");
  const { isOverdue } = useFormatInUserTz();

  const [sorting, setSorting] = useState<SortingState>([{ id: "dueDate", desc: false }]);

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getRowId: (row) => row.id,
    state: { sorting },
  });

  return (
    <div className="overflow-hidden rounded-md border">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {isPending ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center">
                <Spinner />
              </TableCell>
            </TableRow>
          ) : table.getRowModel().rows.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                onClick={() => router.push(`/shared/${grantorId}/task/${row.original.id}`)}
                className={cn(
                  "cursor-pointer",
                  (() => {
                    const overdue =
                      !!row.original.dueDate &&
                      isOverdue(row.original.dueDate) &&
                      row.original.status !== TaskStatus.COMPLETED;
                    return overdue && "bg-red-300/10 text-red-300";
                  })(),
                )}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center">
                {t("noResults")}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      <Separator />
      <div className="flex items-center justify-end gap-x-2 p-4">
        <Button
          variant={"outline"}
          size={"sm"}
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          <ChevronLeft />
        </Button>
        <Button variant={"outline"} size={"sm"} onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
};
