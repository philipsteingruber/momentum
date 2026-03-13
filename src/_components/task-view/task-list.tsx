"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTaskColumns } from "@/hooks/use-task-columns";
import { parseTaskStatus } from "@/lib/task-utils";
import { trpc } from "@/trpc/client";
import { KanbanSquareIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { TaskDataTable } from "../data-table";
import { KanbanBoard } from "../kanban/kanban-board";

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
    onSuccess: (_data, variables) => {
      toast.success(`Successfully marked task(s) as ${parseTaskStatus(variables.newStatus)}`);
      trpcUtils.task.getAllTasks.invalidate();
    },
    onMutate: async ({ taskId, newStatus }) => {
      await trpcUtils.task.getAllTasks.cancel({ categoryId: activeCategoryId });
      const taskCache = trpcUtils.task.getAllTasks.getData({ categoryId: activeCategoryId });
      trpcUtils.task.getAllTasks.setData({ categoryId: activeCategoryId }, (oldTasks) => {
        return oldTasks?.map((task) => (task.id === taskId ? { ...task, status: newStatus } : task));
      });
      return taskCache;
    },
    onError: (_error, _variables, context) => {
      toast.error("Failed to update task status");
      trpcUtils.task.getAllTasks.setData({ categoryId: activeCategoryId }, () => context);
    },
    onSettled: () => trpcUtils.task.getAllTasks.invalidate({ categoryId: activeCategoryId }),
  });

  const [selectedCategoryId, setSelectedCategoryId] = useState<string | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedView, setSelectedView] = useState<"list" | "kanban">("list");

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
  const filteredTasks = tasks?.filter((task) => task.title.toLowerCase().includes(searchQuery.toLowerCase())) ?? [];

  return (
    <div className="flex w-full items-center justify-between">
      <Tabs className="w-full" value={activeCategoryId} onValueChange={(val) => setSelectedCategoryId(val)}>
        <TabsList className="w-full px-4">
          <div className="flex w-full items-center justify-between">
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
            <div className="flex items-center gap-x-8">
              <div className="flex items-center gap-x-4">
                <Label>Search</Label>
                <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
              </div>
              <div className="flex items-center gap-x-2">
                <Label htmlFor="switchView">
                  <KanbanSquareIcon />
                  Kanban View
                </Label>
                <Switch
                  checked={selectedView === "kanban"}
                  onCheckedChange={(checked) => setSelectedView(checked ? "kanban" : "list")}
                  id="switchView"
                />
              </div>
            </div>
          </div>
        </TabsList>
        {selectedCategory ? (
          <TabsContent value={selectedCategory.id}>
            {selectedView === "list" ? (
              <Card>
                <CardContent>
                  <TaskDataTable
                    columns={columns}
                    data={filteredTasks}
                    isPending={isLoadingTasks}
                    deleteTask={deleteTask}
                    isDeletingTask={isDeletingTask}
                    updateTaskStatus={updateTaskStatus}
                    isUpdatingTaskStatus={isUpdatingTaskStatus}
                  />
                </CardContent>
              </Card>
            ) : (
              <KanbanBoard tasks={filteredTasks} updateTaskStatus={updateTaskStatus} isPending={isLoadingTasks} />
            )}
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
