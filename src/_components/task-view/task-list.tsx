"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTaskColumns } from "@/hooks/use-task-columns";
import { trpc } from "@/trpc/client";
import { useState } from "react";
import { toast } from "sonner";
import { DataTable } from "../data-table";

export const TaskList = () => {
  const { data: categories, isPending: isLoadingCategories } = trpc.category.getAll.useQuery();

  const trpcUtils = trpc.useUtils();
  const { mutate: deleteTask, isPending: isDeletingTask } = trpc.task.delete.useMutation({
    onSuccess: () => {
      toast.success("Successfully deleted task(s)");
      trpcUtils.task.getAllTasks.invalidate();
    },
  });
  const { mutate: updateTaskStatus, isPending: isUpdatingTaskStatus } = trpc.task.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("Successfully marked task(s) as Completed");
      trpcUtils.task.getAllTasks.invalidate();
    },
  });

  const [selectedCategoryId, setSelectedCategoryId] = useState<string | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState<string>("");

  const activeCategoryId = selectedCategoryId ?? categories?.[0]?.id;
  const selectedCategory = categories?.find((c) => c.id === activeCategoryId);

  const { data: tasks, isPending: isLoadingTasks } = trpc.task.getAllTasks.useQuery(
    {
      categoryId: activeCategoryId,
    },
    { enabled: !!activeCategoryId },
  );

  const isEmpty = !isLoadingCategories && (!categories || categories.length === 0);
  const columns = useTaskColumns();

  return (
    <div className="flex items-center justify-between w-full">
      <Tabs className="w-full" value={activeCategoryId} onValueChange={(val) => setSelectedCategoryId(val)}>
        <TabsList className="w-full">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-x-2">
              {isLoadingCategories ? (
                <Spinner />
              ) : (
                categories?.map((category) => (
                  <TabsTrigger value={category.id} key={category.id}>
                    {`${category.name} - ${category.taskCount}`}
                  </TabsTrigger>
                ))
              )}
            </div>
            <div className="flex items-center gap-x-2 ">
              <Label>Search</Label>
              <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
          </div>
        </TabsList>
        {selectedCategory ? (
          <TabsContent value={selectedCategory.id}>
            <Card>
              <CardContent>
                <DataTable
                  columns={columns}
                  data={tasks ?? []}
                  isPending={isLoadingTasks}
                  taskNameFilter={searchQuery}
                  deleteTask={deleteTask}
                  isDeletingTask={isDeletingTask}
                  updateTaskStatus={updateTaskStatus}
                  isUpdatingTaskStatus={isUpdatingTaskStatus}
                />
              </CardContent>
            </Card>
          </TabsContent>
        ) : (
          <Card>
            <CardContent className="flex h-24 items-center justify-center">
              {isLoadingCategories ? (
                <Spinner />
              ) : isEmpty ? (
                <p className="text-muted-foreground">No categories found. Create one to get started.</p>
              ) : null}
            </CardContent>
          </Card>
        )}
      </Tabs>
    </div>
  );
};
