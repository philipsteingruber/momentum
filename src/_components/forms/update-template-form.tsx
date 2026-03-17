"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import type { Category, RecurringTemplate } from "@/generated/prisma/client";
import { RecurrenceType } from "@/generated/prisma/enums";
import { useDialogState } from "@/hooks/use-dialog-state";
import { DAY_OF_MONTH_OPTIONS, DAY_OF_WEEK_OPTIONS } from "@/lib/recurring-template-utils";
import { updateRecurringTemplateSchema } from "@/lib/schemas";
import { capitaliseFirstCharacter } from "@/lib/task-utils";
import { trpc } from "@/trpc/client";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import type z from "zod";

export const UpdateTemplateForm = ({
  template,
  categories,
}: {
  template: RecurringTemplate;
  categories: Category[];
}) => {
  const trpcUtils = trpc.useUtils();

  const { mutate: updateTemplate, isPending: isUpdatingTemplate } = trpc.recurringTemplate.update.useMutation({
    onSuccess: () => {
      toast.success("Successfully updated template");
      trpcUtils.recurringTemplate.getAll.invalidate();
    },
  });

  const { mutate: deleteTemplate, isPending: isDeletingTemplate } = trpc.recurringTemplate.delete.useMutation({
    onSuccess: () => {
      toast.success("Successfully deleted template");
      trpcUtils.recurringTemplate.getAll.invalidate();
      trpcUtils.category.getAll.invalidate();
      trpcUtils.task.getAll.invalidate();
      setIsOpen(false);
    },
  });

  const { handleOpenChange, isOpen, setIsOpen } = useDialogState({ preventClose: isDeletingTemplate });

  const form = useForm<z.infer<typeof updateRecurringTemplateSchema>>({
    resolver: zodResolver(updateRecurringTemplateSchema),
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
      },
    },
    mode: "all",
  });

  const onSubmit = (data: z.infer<typeof updateRecurringTemplateSchema>) => {
    updateTemplate(data);
  };

  const selectedRecurrenceType = form.watch("data.recurrenceType");
  const formId = `updateTemplate-${template.id}`;

  return (
    <form id={formId} onSubmit={form.handleSubmit(onSubmit)} className="mt-4 flex flex-col gap-y-4">
      <FieldGroup>
        <Controller
          name="data.title"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={`title-${template.id}`}>Title</FieldLabel>
              <Input
                {...field}
                id={`title-${template.id}`}
                aria-invalid={fieldState.invalid}
                placeholder="Enter a title"
                autoComplete="off"
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          name="data.description"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={`description-${template.id}`}>Description</FieldLabel>
              <Input
                {...field}
                id={`description-${template.id}`}
                aria-invalid={fieldState.invalid}
                placeholder="Enter a description"
                autoComplete="off"
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
      </FieldGroup>
      <Separator />
      <FieldGroup>
        <div className="flex items-center gap-x-4">
          <Controller
            name="data.recurrenceType"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel>Recurrence Type</FieldLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Recurrence Type" />
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
              name="data.dayOfMonth"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel>On Every</FieldLabel>
                  <Select value={field.value?.toString()} onValueChange={(val) => field.onChange(Number(val))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose day of the month" />
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
              name="data.dayOfWeek"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel>On Every</FieldLabel>
                  <Select value={field.value?.toString()} onValueChange={(val) => field.onChange(Number(val))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose day of the week" />
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
          name="data.categoryId"
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
          name="data.externalContact"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={`externalContact-${template.id}`}>External Contact</FieldLabel>
              <Input
                {...field}
                id={`externalContact-${template.id}`}
                aria-invalid={fieldState.invalid}
                placeholder="Enter any External Contacts"
                autoComplete="off"
              />
            </Field>
          )}
        />
        <Controller
          name="data.link"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={`link-${template.id}`}>External Link</FieldLabel>
              <Input
                {...field}
                id={`link-${template.id}`}
                aria-invalid={fieldState.invalid}
                placeholder="Enter any External Link"
                autoComplete="off"
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
      </FieldGroup>
      <div className="flex w-full items-center justify-end gap-x-4 pr-4">
        <Button disabled={isUpdatingTemplate} onClick={() => form.reset()} variant={"outline"} type="button">
          Reset
        </Button>
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
          <DialogTrigger asChild>
            <Button variant={"destructive"} type="button">
              Delete
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Really delete template?</DialogTitle>
              <DialogDescription>
                This will permanently delete the template and all associated pending tasks. Completed tasks will be
                unlinked but preserved.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant={"outline"}>Back</Button>
              </DialogClose>
              <Button variant={"destructive"} onClick={() => deleteTemplate({ templateId: template.id })}>
                {isDeletingTemplate ? <Spinner /> : "Confirm"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Button
          disabled={isUpdatingTemplate || !form.formState.isValid || !form.formState.isDirty}
          type="submit"
          form={formId}
        >
          {isUpdatingTemplate ? <Spinner /> : "Submit"}
        </Button>
      </div>
    </form>
  );
};
