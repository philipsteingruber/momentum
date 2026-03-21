"use client";

import { CollapsibleListItem } from "@/_components/collapsible-list-item";
import CreateTemplateDialog from "@/_components/forms/create-template-dialog";
import { UpdateTemplateForm } from "@/_components/forms/update-template-form";
import { MaxWidthWrapper } from "@/_components/max-width-wrapper";
import { QueryState } from "@/_components/query-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/trpc/client";
import { SearchIcon } from "lucide-react";
import { useTranslations } from "next-intl";

const Page = () => {
  const t = useTranslations("TemplatesPage");
  const { data: templates, isPending: isLoadingTemplates, isError, error } = trpc.recurringTemplate.getAll.useQuery();
  const { data: categories, isPending: isLoadingCategories } = trpc.category.getAll.useQuery();

  return (
    <QueryState
      isPending={isLoadingTemplates || isLoadingCategories}
      isError={isError}
      error={error}
      title={t("title")}
    >
      <MaxWidthWrapper>
        <Card className="w-full">
          <CardHeader>
            <div className="flex w-full items-center justify-between">
              <CardTitle>{t("title")}</CardTitle>
              <CreateTemplateDialog categories={categories ?? []} />
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-y-4 px-4">
            {(templates ?? []).length === 0 ? (
              <Card className="h-[200px] w-full border-0 shadow-none">
                <CardContent className="flex h-full flex-col items-center justify-center gap-y-4">
                  <SearchIcon />
                  <span>{t("empty")}</span>
                </CardContent>
              </Card>
            ) : (
              (templates ?? []).map((template) => (
                <CollapsibleListItem key={template.id} label={template.title}>
                  <UpdateTemplateForm template={template} categories={categories ?? []} />
                </CollapsibleListItem>
              ))
            )}
          </CardContent>
        </Card>
      </MaxWidthWrapper>
    </QueryState>
  );
};

export default Page;
