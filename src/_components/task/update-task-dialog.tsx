"use client";

import { TaskFormFields } from "@/_components/task/task-form-fields";
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
import type { Category, Task } from "@/generated/prisma/client";
import { useDialogState } from "@/hooks/use-dialog-state";
import { useFormatInUserTz } from "@/hooks/use-format-in-user-tz";
import { updateTaskSchema } from "@/lib/schemas";
import { trpc } from "@/trpc/client";
import { zodResolver } from "@hookform/resolvers/zod";
import { PenIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type z from "zod";

const getDefaultValues = (task: Task) => ({
  taskId: task.id,
  data: {
    title: task.title,
    description: task.description ?? "",
    categoryId: task.categoryId ?? "",
    externalContact: task.externalContact ?? "",
    link: task.link ?? "",
    dueDate: task.dueDate ?? undefined,
  },
});

export const UpdateTaskDialog = ({ categories, task }: { categories: Category[]; task: Task }) => {
  const t = useTranslations("UpdateTaskDialog");
  const form = useForm<z.infer<typeof updateTaskSchema>>({
    resolver: zodResolver(updateTaskSchema),
    defaultValues: getDefaultValues(task),
    mode: "all",
  });

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
      form.reset(getDefaultValues(task));
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
          <TaskFormFields
            control={form.control}
            prefix="data."
            categories={categories}
            fmt={fmt}
            labels={{
              titleLabel: t("titleLabel"),
              titlePlaceholder: t("titlePlaceholder"),
              descriptionLabel: t("descriptionLabel"),
              descriptionPlaceholder: t("descriptionPlaceholder"),
              dueDateLabel: t("dueDateLabel"),
              dueDatePlaceholder: t("dueDatePlaceholder"),
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
            <Button type="submit" disabled={!form.formState.isValid || isUpdatingTask}>
              {isUpdatingTask ? <Spinner /> : t("submit")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
