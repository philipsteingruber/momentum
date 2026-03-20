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
import type { Category } from "@/generated/prisma/client";
import { useDialogState } from "@/hooks/use-dialog-state";
import { useFormatInUserTz } from "@/hooks/use-format-in-user-tz";
import { createTaskSchema } from "@/lib/schemas";
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
  categoryId: defaultCategoryId ?? undefined,
  externalContact: "",
  link: "",
});

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
    defaultValues: getDefaultValues(defaultCategoryId),
    mode: "all",
  });
  const trpcUtils = trpc.useUtils();
  const { fmt } = useFormatInUserTz();

  const { mutate: createTask, isPending: isCreatingTask } = trpc.task.create.useMutation({
    onSuccess: () => {
      toast.success(t("successToast"));
      setIsOpen(false);
      form.reset(getDefaultValues(defaultCategoryId));
      trpcUtils.task.getAll.invalidate();
      trpcUtils.category.getAll.invalidate();
    },
  });
  const { isOpen, setIsOpen, handleOpenChange } = useDialogState({
    preventClose: isCreatingTask,
    onClose: () => form.reset(getDefaultValues(defaultCategoryId)),
  });

  useEffect(() => {
    if (isOpen) {
      form.reset(getDefaultValues(defaultCategoryId));
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
          <TaskFormFields
            control={form.control}
            prefix=""
            categories={categories}
            fmt={fmt}
            autoFocus
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
