"use client";

import { ErrorCard } from "@/_components/cards/error-card";
import { LoadingCard } from "@/_components/cards/loading-card";
import CreateTemplateDialog from "@/_components/forms/create-template-dialog";
import { UpdateTemplateForm } from "@/_components/forms/update-template-form";
import { MaxWidthWrapper } from "@/_components/max-width-wrapper";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { trpc } from "@/trpc/client";
import { ArrowUpDownIcon, SearchIcon } from "lucide-react";

const Page = () => {
  const { data: templates, isPending: isLoadingTemplates, isError, error } = trpc.recurringTemplate.getAll.useQuery();
  const { data: categories, isPending: isLoadingCategories } = trpc.category.getAll.useQuery();

  if (isLoadingTemplates || isLoadingCategories) {
    return (
      <MaxWidthWrapper>
        <LoadingCard title="Templates" className="w-full" />
      </MaxWidthWrapper>
    );
  }
  if (isError) {
    return (
      <MaxWidthWrapper>
        <ErrorCard title="Templates" error={error.message} className="w-full" />
      </MaxWidthWrapper>
    );
  }
  return (
    <MaxWidthWrapper>
      <Card className="w-full">
        <CardHeader>
          <div className="flex w-full items-center justify-between">
            <CardTitle>Templates</CardTitle>
            <CreateTemplateDialog categories={categories ?? []} />
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-y-4 px-4">
          {templates.length === 0 ? (
            <Card className="h-[200px] w-full border-0 shadow-none">
              <CardContent className="flex h-full flex-col items-center justify-center gap-y-4">
                <SearchIcon />
                <span>No templates found.</span>
              </CardContent>
            </Card>
          ) : (
            templates.map((template) => (
              <Collapsible key={template.id} className="cursor-pointer rounded border p-4">
                <CollapsibleTrigger asChild>
                  <div className="flex w-full items-center justify-between">
                    <span className="font-semibold">{template.title}</span>
                    <ArrowUpDownIcon />
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent className="data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up cursor-default overflow-hidden">
                  <UpdateTemplateForm template={template} categories={categories ?? []} />
                </CollapsibleContent>
              </Collapsible>
            ))
          )}
        </CardContent>
      </Card>
    </MaxWidthWrapper>
  );
};

export default Page;
