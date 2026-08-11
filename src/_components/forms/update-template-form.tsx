"use client";

import { ConfirmDeleteDialog } from "@/_components/confirm-delete-dialog";
import { TemplateFormFields } from "@/_components/forms/template-form-fields";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { Category, RecurringTemplate } from "@/generated/prisma/client";
import { makeUpdateRecurringTemplateSchema } from "@/lib/schemas";
import { trpc } from "@/trpc/client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type z from "zod";

export const UpdateTemplateForm = ({
  template,
  categories,
}: {
  template: RecurringTemplate;
  categories: Category[];
}) => {
  const t = useTranslations("UpdateTemplateForm");
  const tSchemas = useTranslations("Schemas");
  const schema = makeUpdateRecurringTemplateSchema({
    titleRequired: tSchemas("titleRequired"),
    titleMaxLength: tSchemas("titleMaxLength"),
    descriptionMaxLength: tSchemas("descriptionMaxLength"),
    linkInvalid: tSchemas("linkInvalid"),
    reminderTimeInvalid: tSchemas("reminderTimeInvalid"),
    reminderTimeRequiresDaily: tSchemas("reminderTimeRequiresDaily"),
  });
  const trpcUtils = trpc.useUtils();

  const { mutate: updateTemplate, isPending: isUpdatingTemplate } = trpc.recurringTemplate.update.useMutation({
    onSuccess: () => {
      toast.success(t("updatedToast"));
      trpcUtils.recurringTemplate.getAll.invalidate();
    },
  });

  const { mutate: deleteTemplate, isPending: isDeletingTemplate } = trpc.recurringTemplate.delete.useMutation({
    onSuccess: () => {
      toast.success(t("deletedToast"));
      trpcUtils.recurringTemplate.getAll.invalidate();
      trpcUtils.category.getAll.invalidate();
      trpcUtils.task.getAll.invalidate();
    },
  });

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      templateId: template.id,
      data: {
        title: template.title,
        description: template.description ?? "",
        recurrenceType: template.recurrenceType,
        dayOfWeek: template.dayOfWeek ?? undefined,
        dayOfMonth: template.dayOfMonth ?? undefined,
        categoryId: template.categoryId ?? "",
        externalContact: template.externalContact ?? "",
        link: template.link ?? "",
        reminderTime: template.reminderTime ?? undefined,
      },
    },
    mode: "all",
  });

  const onSubmit = (data: z.infer<typeof schema>) => {
    updateTemplate(data);
  };

  // eslint-disable-next-line react-hooks/incompatible-library
  const selectedRecurrenceType = form.watch("data.recurrenceType");
  const formId = `updateTemplate-${template.id}`;

  return (
    <form id={formId} onSubmit={form.handleSubmit(onSubmit)} className="mt-4 flex flex-col gap-y-4">
      <TemplateFormFields
        control={form.control}
        prefix="data."
        categories={categories}
        selectedRecurrenceType={selectedRecurrenceType}
        idSuffix={template.id}
        labels={{
          titleLabel: t("titleLabel"),
          titlePlaceholder: t("titlePlaceholder"),
          descriptionLabel: t("descriptionLabel"),
          descriptionPlaceholder: t("descriptionPlaceholder"),
          recurrenceTypeLabel: t("recurrenceTypeLabel"),
          recurrenceTypePlaceholder: t("recurrenceTypePlaceholder"),
          onEveryLabel: t("onEveryLabel"),
          dayOfMonthPlaceholder: t("dayOfMonthPlaceholder"),
          dayOfWeekPlaceholder: t("dayOfWeekPlaceholder"),
          reminderTimeLabel: t("reminderTimeLabel"),
          clearReminderTimeLabel: t("clearReminderTimeLabel"),
          categoryLabel: t("categoryLabel"),
          categoryPlaceholder: t("categoryPlaceholder"),
          externalContactLabel: t("externalContactLabel"),
          externalContactPlaceholder: t("externalContactPlaceholder"),
          externalLinkLabel: t("externalLinkLabel"),
          externalLinkPlaceholder: t("externalLinkPlaceholder"),
        }}
      />
      <div className="flex w-full items-center justify-end gap-x-4 pr-4">
        <Button disabled={isUpdatingTemplate} onClick={() => form.reset()} variant={"outline"} type="button">
          {t("reset")}
        </Button>
        <ConfirmDeleteDialog
          trigger={
            <Button variant={"destructive"} type="button">
              {t("delete")}
            </Button>
          }
          title={t("deleteDialogTitle")}
          description={t("deleteDialogDescription")}
          cancelLabel={t("back")}
          confirmLabel={t("confirm")}
          onConfirm={() => deleteTemplate({ templateId: template.id })}
          isPending={isDeletingTemplate}
        />
        <Button
          disabled={isUpdatingTemplate || !form.formState.isValid || !form.formState.isDirty}
          type="submit"
          form={formId}
        >
          {isUpdatingTemplate ? <Spinner /> : t("submit")}
        </Button>
      </div>
    </form>
  );
};
