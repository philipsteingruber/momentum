"use client";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import type { Category, Task } from "@/generated/prisma/client";
import { useDialogState } from "@/hooks/use-dialog-state";
import { useFormatInUserTz } from "@/hooks/use-format-in-user-tz";
import { updateTaskSchema } from "@/lib/schemas";
import { trpc } from "@/trpc/client";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarIcon, PenIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import type z from "zod";

export const UpdateTaskDialog = ({ categories, task }: { categories: Category[]; task: Task }) => {
  const t = useTranslations("UpdateTaskDialog");
  const form = useForm<z.infer<typeof updateTaskSchema>>({
    resolver: zodResolver(updateTaskSchema),
    defaultValues: {
      taskId: task.id,
      data: {
        title: task.title,
        description: task.description ?? "",
        categoryId: task.categoryId ?? "",
        externalContact: task.externalContact ?? "",
        link: task.link ?? "",
        dueDate: task.dueDate ?? undefined,
      },
    },
    mode: "all",
  });

  const [datePickerOpen, setDatePickerOpen] = useState<boolean>(false);
  const trpcUtils = trpc.useUtils();
  const { fmt } = useFormatInUserTz();

  const { mutate: updateTask, isPending: isUpdatingTask } = trpc.task.update.useMutation({
    onSuccess: () => {
      toast.success(t("successToast"));
      setIsOpen(false);
      form.reset();
      trpcUtils.task.getAll.invalidate();
      trpcUtils.task.getById.invalidate({ taskId: task.id });
      trpcUtils.category.getAll.invalidate();
    },
  });

  const { isOpen, setIsOpen, handleOpenChange } = useDialogState({
    preventClose: isUpdatingTask,
    onClose: () => form.reset(),
  });

  useEffect(() => {
    if (isOpen) {
      form.reset({
        taskId: task.id,
        data: {
          title: task.title,
          description: task.description ?? "",
          dueDate: task.dueDate ?? undefined,
          categoryId: task.categoryId ?? "",
          externalContact: task.externalContact ?? "",
          link: task.link ?? "",
        },
      });
    }
  }, [isOpen, form, task]);

  const onSubmit = (data: z.infer<typeof updateTaskSchema>) => {
    updateTask(data);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <PenIcon /> {t("trigger")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle> {t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <FieldGroup>
            <Controller
              name="data.title"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="title">{t("titleLabel")}</FieldLabel>
                  <Input
                    {...field}
                    id="title"
                    aria-invalid={fieldState.invalid}
                    placeholder={t("titlePlaceholder")}
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
                  <FieldLabel htmlFor="description">{t("descriptionLabel")}</FieldLabel>
                  <Input
                    {...field}
                    id="description"
                    aria-invalid={fieldState.invalid}
                    placeholder={t("descriptionPlaceholder")}
                    autoComplete="off"
                  />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
          </FieldGroup>
          <Separator className="my-4" />
          <FieldGroup>
            <Controller
              name="data.dueDate"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel>{t("dueDateLabel")}</FieldLabel>
                  <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                    <PopoverTrigger asChild>
                      <Button>
                        <CalendarIcon />
                        {field.value ? fmt(field.value, "yyyy-MM-dd") : t("dueDatePlaceholder")}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent>
                      <Calendar
                        mode="single"
                        disabled={{ before: new Date() }}
                        selected={field.value}
                        defaultMonth={field.value ?? new Date()}
                        onSelect={field.onChange}
                        onDayClick={() => setDatePickerOpen(false)}
                        weekStartsOn={1}
                      />
                    </PopoverContent>
                  </Popover>
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
            <Controller
              name="data.categoryId"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel>{t("categoryLabel")}</FieldLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("categoryPlaceholder")} />
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
                  <FieldLabel htmlFor="externalContact">{t("externalContactLabel")}</FieldLabel>
                  <Input
                    {...field}
                    id="externalContact"
                    aria-invalid={fieldState.invalid}
                    placeholder={t("externalContactPlaceholder")}
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
                  <FieldLabel htmlFor="link">{t("externalLinkLabel")}</FieldLabel>
                  <Input
                    {...field}
                    id="link"
                    aria-invalid={fieldState.invalid}
                    placeholder={t("externalLinkPlaceholder")}
                    autoComplete="off"
                  />
                </Field>
              )}
            />
          </FieldGroup>
          <Separator className="my-4" />
          <div className="flex w-full items-center justify-end gap-x-4">
            <DialogClose asChild>
              <Button variant={"outline"}>{t("cancel")}</Button>
            </DialogClose>
            <Button type="submit" disabled={!form.formState.isValid || isUpdatingTask}>
              {isUpdatingTask ? <Spinner /> : t("submit")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
