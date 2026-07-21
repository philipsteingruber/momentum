"use client";

import { TemplateFormFields } from "@/_components/forms/template-form-fields";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { type Category } from "@/generated/prisma/client";
import { RecurrenceType } from "@/generated/prisma/enums";
import { useDialogState } from "@/hooks/use-dialog-state";
import { makeCreateRecurringTemplateSchema } from "@/lib/schemas";
import { trpc } from "@/trpc/client";
import { zodResolver } from "@hookform/resolvers/zod";
import { PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type z from "zod";

const getDefaultValues = (defaultCategoryId?: string) => ({
  title: "",
  description: "",
  categoryId: defaultCategoryId,
  externalContact: "",
  link: "",
  recurrenceType: RecurrenceType.DAILY,
  reminderTime: undefined,
});

const CreateTemplateDialog = ({
  categories,
  defaultCategoryId,
}: {
  categories: Category[];
  defaultCategoryId?: string;
}) => {
  const t = useTranslations("CreateTemplateDialog");
  const tSchemas = useTranslations("Schemas");
  const schema = makeCreateRecurringTemplateSchema({
    titleRequired: tSchemas("titleRequired"),
    titleMaxLength: tSchemas("titleMaxLength"),
    descriptionMaxLength: tSchemas("descriptionMaxLength"),
    linkInvalid: tSchemas("linkInvalid"),
    recurrenceDayRequired: tSchemas("recurrenceDayRequired"),
    recurrenceInvalidCombination: tSchemas("recurrenceInvalidCombination"),
    reminderTimeInvalid: tSchemas("reminderTimeInvalid"),
    reminderTimeRequiresDaily: tSchemas("reminderTimeRequiresDaily"),
  });
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: getDefaultValues(defaultCategoryId),
    mode: "all",
  });
  const trpcUtils = trpc.useUtils();

  const { mutate: createTemplate, isPending: isCreatingTemplate } = trpc.recurringTemplate.create.useMutation({
    onSuccess: () => {
      toast.success(t("createdToast"));
      setIsOpen(false);
      form.reset(getDefaultValues(defaultCategoryId));
      trpcUtils.task.getAll.invalidate();
      trpcUtils.recurringTemplate.getAll.invalidate();
      trpcUtils.category.getAll.invalidate();
    },
  });
  const { isOpen, setIsOpen, handleOpenChange } = useDialogState({
    preventClose: isCreatingTemplate,
    onClose: () => form.reset(getDefaultValues(defaultCategoryId)),
  });

  useEffect(() => {
    if (isOpen) {
      form.reset(getDefaultValues(defaultCategoryId));
    }
  }, [isOpen, defaultCategoryId, form]);

  const onSubmit = (data: z.infer<typeof schema>) => {
    createTemplate(data);
  };

  // eslint-disable-next-line react-hooks/incompatible-library
  const selectedRecurrenceType = form.watch("recurrenceType");

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="flex items-center gap-x-2">
          <PlusIcon /> {t("trigger")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <TemplateFormFields
            control={form.control}
            prefix=""
            categories={categories}
            selectedRecurrenceType={selectedRecurrenceType}
            autoFocus
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
              categoryLabel: t("categoryLabel"),
              categoryPlaceholder: t("categoryPlaceholder"),
              externalContactLabel: t("externalContactLabel"),
              externalContactPlaceholder: t("externalContactPlaceholder"),
              externalLinkLabel: t("externalLinkLabel"),
              externalLinkPlaceholder: t("externalLinkPlaceholder"),
            }}
          />
          <Separator className="my-4" />
          <div className="flex w-full items-center justify-end gap-x-4">
            <DialogClose asChild>
              <Button variant={"outline"}>{t("cancel")}</Button>
            </DialogClose>
            <Button type="submit" disabled={!form.formState.isValid || isCreatingTemplate}>
              {isCreatingTemplate ? <Spinner /> : t("submit")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateTemplateDialog;
