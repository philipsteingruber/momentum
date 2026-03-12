"use client";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Task } from "@/generated/prisma/client";
import { TaskStatus } from "@/generated/prisma/enums";
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
import { isBefore } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

interface DataTableProps {
  columns: ColumnDef<Task, unknown>[];
  data: Task[];
  taskNameFilter?: string;
  isPending: boolean;
  deleteTask: ({ taskId }: { taskId: string }) => void;
  isDeletingTask: boolean;
  updateTaskStatus: ({ taskId, newStatus }: { taskId: string; newStatus: TaskStatus }) => void;
  isUpdatingTaskStatus: boolean;
}

export const TaskDataTable = ({
  columns,
  data,
  taskNameFilter,
  isPending,
  deleteTask,
  isDeletingTask,
  updateTaskStatus,
  isUpdatingTaskStatus,
}: DataTableProps) => {
  const columnFilters = useMemo(
    () => (taskNameFilter ? [{ id: "title", value: taskNameFilter }] : []),
    [taskNameFilter],
  );
  const router = useRouter();

  const [sorting, setSorting] = useState<SortingState>([{ id: "dueDate", desc: false }]);
  const [rowSelection, setRowSelection] = useState({});

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onRowSelectionChange: setRowSelection,
    getRowId: (row) => row.id,
    state: { sorting, columnFilters, rowSelection },
  });

  return (
    <div className="overflow-hidden rounded-md border">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                return (
                  <TableHead key={header.id}>
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                );
              })}
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
                data-state={row.getIsSelected() && "selected"}
                onClick={() => router.push(`/task/${row.original.id}`)}
                className={cn(
                  "cursor-pointer",
                  (() => {
                    const isOverdue =
                      !!row.original.dueDate &&
                      isBefore(row.original.dueDate, new Date()) &&
                      row.original.status !== TaskStatus.COMPLETED;
                    return isOverdue && "bg-red-300/10 text-red-300";
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
                No results.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      <Separator />
      <div className="flex items-center justify-between">
        <div className="flex items-center justify-start gap-x-2 ml-4">
          <Button
            variant={"destructive"}
            onClick={() => {
              Object.keys(rowSelection).forEach((taskId) => {
                deleteTask({ taskId });
              });
              setRowSelection({});
            }}
            disabled={isDeletingTask || isUpdatingTaskStatus || Object.keys(rowSelection).length === 0}
          >
            {isDeletingTask ? <Spinner /> : "Delete"}
          </Button>
          <Button
            variant={"outline"}
            onClick={() => {
              Object.keys(rowSelection).forEach((taskId) => {
                updateTaskStatus({ taskId, newStatus: TaskStatus.COMPLETED });
              });
              setRowSelection({});
            }}
            disabled={isDeletingTask || isUpdatingTaskStatus || Object.keys(rowSelection).length === 0}
          >
            {isUpdatingTaskStatus ? <Spinner /> : "Complete"}
          </Button>
        </div>
        <div className="flex items-center justify-end gap-x-2 py-4 mr-4">
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
    </div>
  );
};
