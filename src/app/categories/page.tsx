"use client";

import { EmptyCard } from "@/_components/cards/empty-card";
import { ErrorCard } from "@/_components/cards/error-card";
import { LoadingCard } from "@/_components/cards/loading-card";
import { CreateCategoryDialog } from "@/_components/forms/create-category-dialog";
import { UpdateCategoryForm } from "@/_components/forms/edit-category-form";
import { MaxWidthWrapper } from "@/_components/max-width-wrapper";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { trpc } from "@/trpc/client";
import { ArrowUpDownIcon } from "lucide-react";

const Page = () => {
  const { data: categories, isPending: isLoadingCategories, isError, error } = trpc.category.getAll.useQuery();

  if (isLoadingCategories) {
    return (
      <MaxWidthWrapper>
        <LoadingCard title="Categories" className="w-full" />
      </MaxWidthWrapper>
    );
  }
  if (isError) {
    return (
      <MaxWidthWrapper>
        <ErrorCard title="Categories" error={error.message} className="w-full" />
      </MaxWidthWrapper>
    );
  }
  if (categories.length === 0) {
    return (
      <MaxWidthWrapper>
        <EmptyCard title="Categories" message="No categories found." />
      </MaxWidthWrapper>
    );
  }

  return (
    <MaxWidthWrapper>
      <Card className="w-full">
        <CardHeader className="flex w-full items-center justify-between">
          <CardTitle>Categories</CardTitle>
          <CreateCategoryDialog />
        </CardHeader>
        <CardContent className="flex flex-col gap-y-4 px-4">
          {categories.map((category) => (
            <Collapsible key={category.id} className="cursor-pointer rounded border p-4">
              <CollapsibleTrigger asChild>
                <div className="flex w-full items-center justify-between">
                  <span className="font-semibold">{category.name}</span>
                  <ArrowUpDownIcon />
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent className="data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up cursor-default overflow-hidden">
                <UpdateCategoryForm category={category} />
              </CollapsibleContent>
            </Collapsible>
          ))}
        </CardContent>
      </Card>
    </MaxWidthWrapper>
  );
};

export default Page;
