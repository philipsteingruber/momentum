"use client";

import { SharedTaskDataTable } from "@/_components/shared-task-data-table";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { useSharedTaskColumns } from "@/hooks/use-shared-task-columns";
import { trpc } from "@/trpc/client";
import { KanbanSquareIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { KanbanBoardReadonly } from "../kanban/kanban-board-readonly";

type SharedTaskListProps = {
  grantorId: string;
  /** From ?category= on a copied share link; wins over localStorage until the viewer picks a tab. */
  linkedCategoryId?: string;
  /** From ?view= on a copied share link; wins over localStorage until the viewer toggles the view. */
  linkedView?: "list" | "kanban";
};

export const SharedTaskList = ({ grantorId, linkedCategoryId, linkedView }: SharedTaskListProps) => {
  const t = useTranslations("TaskList");
  const { data: categories, isPending: isLoadingCategories } = trpc.sharedAccess.getCategoriesForGrantor.useQuery({
    grantorId,
  });

  const [selectedCategoryId, setSelectedCategoryId] = useLocalStorage<string | undefined>(
    `shared-task-category-${grantorId}`,
    undefined,
  );
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedView, setSelectedView] = useLocalStorage<"list" | "kanban">(`shared-task-view-${grantorId}`, "list");

  // Link overrides are dropped as soon as the viewer makes their own choice.
  const [categoryOverride, setCategoryOverride] = useState<string | undefined>(linkedCategoryId);
  const [viewOverride, setViewOverride] = useState<"list" | "kanban" | undefined>(linkedView);

  // Ignore a linked category the viewer can't see (excluded, deleted, or a stale link).
  const visibleOverride = categories?.some((c) => c.id === categoryOverride) ? categoryOverride : undefined;
  const activeCategoryId = visibleOverride ?? selectedCategoryId ?? categories?.[0]?.id;
  const activeView = viewOverride ?? selectedView;

  const handleCategoryChange = (categoryId: string) => {
    setCategoryOverride(undefined);
    setSelectedCategoryId(categoryId);
  };

  const handleViewChange = (checked: boolean) => {
    setViewOverride(undefined);
    setSelectedView(checked ? "kanban" : "list");
  };
  const selectedCategory = categories?.find((c) => c.id === activeCategoryId);

  const { data: tasks, isPending: isLoadingTasks } = trpc.sharedAccess.getTasksForGrantor.useQuery({ grantorId });

  const tasksForCategory = tasks?.filter((task) => task.categoryId === activeCategoryId) ?? [];
  const filteredTasks = tasksForCategory.filter(
    (task) =>
      task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.description?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const isEmpty = !isLoadingCategories && (!categories || categories.length === 0);
  const columns = useSharedTaskColumns();

  return (
    <div className="flex w-full items-center justify-between">
      <Tabs className="w-full" value={activeCategoryId} onValueChange={handleCategoryChange}>
        <TabsList className="w-full px-4">
          <div className="flex w-full items-center justify-between">
            <div className="flex items-center gap-x-2">
              {isLoadingCategories ? (
                <Spinner />
              ) : (
                categories?.map((category) => (
                  <TabsTrigger value={category.id} key={category.id}>
                    {category.name}
                  </TabsTrigger>
                ))
              )}
            </div>
            <div className="flex items-center gap-x-8">
              <div className="flex items-center gap-x-4">
                <Label>{t("search")}</Label>
                <div className="flex items-center gap-x-0">
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="focus-visible:border-ring border-ring rounded-r-none focus-visible:ring-0"
                  />
                  <Button className="border-ring rounded-l-none" onClick={() => setSearchQuery("")}>
                    <XIcon />
                  </Button>
                </div>
              </div>
              <div className="flex items-center gap-x-2">
                <Label htmlFor={`switchView-${grantorId}`}>
                  <KanbanSquareIcon />
                  {t("kanbanView")}
                </Label>
                <Switch
                  checked={activeView === "kanban"}
                  onCheckedChange={handleViewChange}
                  id={`switchView-${grantorId}`}
                />
              </div>
            </div>
          </div>
        </TabsList>
        {selectedCategory ? (
          <TabsContent value={selectedCategory.id}>
            {activeView === "list" ? (
              <Card>
                <CardContent>
                  <SharedTaskDataTable
                    columns={columns}
                    data={filteredTasks}
                    isPending={isLoadingTasks}
                    grantorId={grantorId}
                  />
                </CardContent>
              </Card>
            ) : (
              <KanbanBoardReadonly tasks={filteredTasks} isPending={isLoadingTasks} grantorId={grantorId} />
            )}
          </TabsContent>
        ) : (
          <Card>
            <CardContent className="flex h-24 items-center justify-center">
              {isLoadingCategories ? (
                <Spinner />
              ) : isEmpty ? (
                <p className="text-muted-foreground">{t("noCategoriesEmpty")}</p>
              ) : null}
            </CardContent>
          </Card>
        )}
      </Tabs>
    </div>
  );
};
