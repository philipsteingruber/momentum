"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/trpc/client";
import { useState } from "react";
import { DataTable } from "../data-table";
import { columns } from "./columns";

export const TaskList = () => {
  const { data: categories, isPending: isLoadingCategories } = trpc.category.getAll.useQuery();

  const [selectedCategoryId, setSelectedCategoryId] = useState<string | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState<string>("");

  const activeCategoryId = selectedCategoryId ?? categories?.[0]?.id;
  const selectedCategory = categories?.find((c) => c.id === activeCategoryId);

  const { data: tasks, isPending: isLoadingTasks } = trpc.task.getAllTasks.useQuery(
    {
      categoryId: activeCategoryId,
      search: searchQuery !== "" ? searchQuery : undefined,
    },
    { enabled: !!activeCategoryId },
  );

  const isEmpty = !isLoadingCategories && (!categories || categories.length === 0);

  return (
    <div className="flex items-center justify-between w-full">
      <Tabs className="w-full" value={activeCategoryId} onValueChange={(val) => setSelectedCategoryId(val)}>
        <TabsList>
          {isLoadingCategories ? (
            <Spinner />
          ) : (
            categories?.map((category) => (
              <TabsTrigger value={category.id} key={category.id}>
                {`${category.name} - ${category.taskCount}`}
              </TabsTrigger>
            ))
          )}
        </TabsList>
        {selectedCategory ? (
          <TabsContent value={selectedCategory.id}>
            <Card>
              <CardHeader>
                <CardTitle>{`${selectedCategory.name} - Tasks`}</CardTitle>
              </CardHeader>
              <CardContent>
                <DataTable columns={columns} data={tasks ?? []} isPending={isLoadingTasks} />
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
