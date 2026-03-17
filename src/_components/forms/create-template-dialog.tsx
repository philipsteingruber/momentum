"use client";

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
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { type Category } from "@/generated/prisma/client";
import { RecurrenceType } from "@/generated/prisma/enums";
import { useDialogState } from "@/hooks/use-dialog-state";
import { DAY_OF_MONTH_OPTIONS, DAY_OF_WEEK_OPTIONS } from "@/lib/recurring-template-utils";
import { createRecurringTemplateSchema } from "@/lib/schemas";
import { capitaliseFirstCharacter } from "@/lib/task-utils";
import { trpc } from "@/trpc/client";
import { zodResolver } from "@hookform/resolvers/zod";
import { PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import type z from "zod";

const getDefaultValues = (defaultCategoryId?: string) => ({
  title: "",
  description: "",
  categoryId: defaultCategoryId,
  externalContact: "",
  link: "",
  recurrenceType: RecurrenceType.DAILY,
});

const CreateTemplateDialog = ({
  categories,
  defaultCategoryId,
}: {
  categories: Category[];
  defaultCategoryId?: string;
}) => {
  const t = useTranslations("CreateTemplateDialog");
  const form = useForm<z.infer<typeof createRecurringTemplateSchema>>({
    resolver: zodResolver(createRecurringTemplateSchema),
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

  const onSubmit = (data: z.infer<typeof createRecurringTemplateSchema>) => {
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
          <DialogDescription>
            {t("description")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <FieldGroup>
            <Controller
              name="title"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="title">Title</FieldLabel>
                  <Input
                    {...field}
                    id="title"
                    aria-invalid={fieldState.invalid}
                    placeholder="Enter a title"
                    autoComplete="off"
                    autoFocus
                  />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
            <Controller
              name="description"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="description">Description</FieldLabel>
                  <Input
                    {...field}
                    id="description"
                    aria-invalid={fieldState.invalid}
                    placeholder="Enter a description"
                    autoComplete="off"
                  />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
          </FieldGroup>
          <Separator className="my-4" />
          <FieldGroup>
            <div className="flex items-center gap-x-4">
              <Controller
                name="recurrenceType"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel>{t("recurrenceTypeLabel")}</FieldLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder={t("recurrenceTypePlaceholder")} />
                      </SelectTrigger>
                      <SelectContent position="popper">
                        {Object.keys(RecurrenceType).map((type) => (
                          <SelectItem value={type} key={type}>
                            {capitaliseFirstCharacter(type)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                )}
              />
              {selectedRecurrenceType === RecurrenceType.MONTHLY && (
                <Controller
                  name="dayOfMonth"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel>{t("onEveryLabel")}</FieldLabel>
                      <Select value={field.value?.toString()} onValueChange={(val) => field.onChange(Number(val))}>
                        <SelectTrigger>
                          <SelectValue placeholder={t("dayOfMonthPlaceholder")} />
                        </SelectTrigger>
                        <SelectContent position="popper">
                          {DAY_OF_MONTH_OPTIONS.map((day) => (
                            <SelectItem value={day.value.toString()} key={day.value}>
                              {day.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  )}
                />
              )}
              {selectedRecurrenceType === RecurrenceType.WEEKLY && (
                <Controller
                  name="dayOfWeek"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel>{t("onEveryLabel")}</FieldLabel>
                      <Select value={field.value?.toString()} onValueChange={(val) => field.onChange(Number(val))}>
                        <SelectTrigger>
                          <SelectValue placeholder={t("dayOfWeekPlaceholder")} />
                        </SelectTrigger>
                        <SelectContent position="popper">
                          {DAY_OF_WEEK_OPTIONS.map((day) => (
                            <SelectItem value={day.value.toString()} key={day.value}>
                              {day.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  )}
                />
              )}
            </div>
            <Controller
              name="categoryId"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel>Category</FieldLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a Category" />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      {categories.map((category) => (
                        <SelectItem value={category.id} key={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}
            />
            <Controller
              name="externalContact"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="externalContact">External Contact</FieldLabel>
                  <Input
                    {...field}
                    id="externalContact"
                    aria-invalid={fieldState.invalid}
                    placeholder="Enter any External Contacts"
                    autoComplete="off"
                  />
                </Field>
              )}
            />
            <Controller
              name="link"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="link">External Link</FieldLabel>
                  <Input
                    {...field}
                    id="link"
                    aria-invalid={fieldState.invalid}
                    placeholder="Enter any External Link"
                    autoComplete="off"
                  />
                </Field>
              )}
            />
          </FieldGroup>
          <Separator className="my-4" />
          <div className="flex w-full items-center justify-end gap-x-4">
            <DialogClose asChild>
              <Button variant={"outline"}>Cancel</Button>
            </DialogClose>
            <Button type="submit" disabled={!form.formState.isValid || isCreatingTemplate}>
              {isCreatingTemplate ? <Spinner /> : "Submit"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateTemplateDialog;
