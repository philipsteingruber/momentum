"use client";

import { CollapsibleListItem } from "@/_components/collapsible-list-item";
import { CreateCategoryDialog } from "@/_components/forms/create-category-dialog";
import { UpdateCategoryForm } from "@/_components/forms/update-category-form";
import { MaxWidthWrapper } from "@/_components/max-width-wrapper";
import { QueryState } from "@/_components/query-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/trpc/client";
import { useTranslations } from "next-intl";

const Page = () => {
  const t = useTranslations("CategoriesPage");
  const { data: categories, isPending: isLoadingCategories, isError, error } = trpc.category.getAll.useQuery();

  return (
    <QueryState
      isPending={isLoadingCategories}
      isError={isError}
      error={error}
      isEmpty={categories?.length === 0}
      title={t("title")}
      emptyMessage={t("empty")}
    >
      <MaxWidthWrapper>
        <Card className="w-full">
          <CardHeader className="flex w-full items-center justify-between">
            <CardTitle>{t("title")}</CardTitle>
            <CreateCategoryDialog />
          </CardHeader>
          <CardContent className="flex flex-col gap-y-4 px-4">
            {categories!.map((category) => (
              <CollapsibleListItem key={category.id} label={category.name}>
                <UpdateCategoryForm category={category} />
              </CollapsibleListItem>
            ))}
          </CardContent>
        </Card>
      </MaxWidthWrapper>
    </QueryState>
  );
};

export default Page;
