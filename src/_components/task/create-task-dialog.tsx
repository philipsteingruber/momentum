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
import type { Category } from "@/generated/prisma/client";
import { useDialogState } from "@/hooks/use-dialog-state";
import { useFormatInUserTz } from "@/hooks/use-format-in-user-tz";
import { createTaskSchema } from "@/lib/schemas";
import { trpc } from "@/trpc/client";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarIcon, PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import type z from "zod";

const CreateTaskDialog = ({
  categories,
  defaultCategoryId,
}: {
  categories: Category[];
  defaultCategoryId?: string;
}) => {
  const t = useTranslations("CreateTaskDialog");
  const form = useForm<z.infer<typeof createTaskSchema>>({
    resolver: zodResolver(createTaskSchema),
    defaultValues: {
      title: "",
      description: "",
      categoryId: defaultCategoryId ?? undefined,
      externalContact: "",
      link: "",
    },
    mode: "all",
  });
  const [datePickerOpen, setDatePickerOpen] = useState<boolean>(false);
  const trpcUtils = trpc.useUtils();
  const { fmt } = useFormatInUserTz();

  const { mutate: createTask, isPending: isCreatingTask } = trpc.task.create.useMutation({
    onSuccess: () => {
      toast.success(t("successToast"));
      setIsOpen(false);
      form.reset();
      trpcUtils.task.getAll.invalidate();
      trpcUtils.category.getAll.invalidate();
    },
  });
  const { isOpen, setIsOpen, handleOpenChange } = useDialogState({
    preventClose: isCreatingTask,
    onClose: () => form.reset(),
  });

  useEffect(() => {
    if (isOpen) {
      form.reset({
        title: "",
        description: "",
        categoryId: defaultCategoryId ?? undefined,
        externalContact: "",
        link: "",
      });
    }
  }, [isOpen, defaultCategoryId, form]);

  const onSubmit = (data: z.infer<typeof createTaskSchema>) => {
    createTask(data);
  };

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
          <FieldGroup>
            <Controller
              name="title"
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
              name="dueDate"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel>{t("dueDateLabel")}</FieldLabel>
                  <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                    <PopoverTrigger asChild>
                      <Button>
                        <CalendarIcon /> {field.value ? fmt(field.value, "yyyy-MM-dd") : t("dueDatePlaceholder")}
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
              name="categoryId"
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
              name="externalContact"
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
              name="link"
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
            <Button type="submit" disabled={!form.formState.isValid || isCreatingTask}>
              {isCreatingTask ? <Spinner /> : t("submit")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateTaskDialog;
