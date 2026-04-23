import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldContent, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useDialogState } from "@/hooks/use-dialog-state";
import { makeCategorySchema } from "@/lib/schemas";
import { trpc } from "@/trpc/client";
import { zodResolver } from "@hookform/resolvers/zod";
import { PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import type z from "zod";

export const CreateCategoryDialog = () => {
  const t = useTranslations("CreateCategoryDialog");
  const tSchemas = useTranslations("Schemas");
  const schema = makeCategorySchema({
    nameRequired: tSchemas("nameRequired"),
    nameMaxLength: tSchemas("nameMaxLength"),
  });
  const trpcUtils = trpc.useUtils();
  const { mutate: createCategory, isPending: isCreatingCategory } = trpc.category.create.useMutation({
    onSuccess: () => {
      toast.success(t("createdToast"));
      trpcUtils.category.getAll.invalidate();
      setIsOpen(false);
    },
  });

  const { handleOpenChange, isOpen, setIsOpen } = useDialogState({
    preventClose: isCreatingCategory,
    onClose: () => form.reset(),
  });

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { name: "" },
    mode: "all",
  });

  const onSubmit = (data: z.infer<typeof schema>) => {
    createCategory(data);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="flex items-center justify-between gap-x-2">
          <PlusIcon />
          {t("trigger")}
        </Button>
      </DialogTrigger>
      <DialogContent className="w-full">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="w-full">
          <Controller
            name="name"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field aria-invalid={fieldState.invalid} orientation={"horizontal"} className="flex w-full">
                <FieldLabel htmlFor="name" className="mt-1.5 w-10 flex-none!">
                  {t("nameLabel")}
                </FieldLabel>
                <FieldContent>
                  <Input id="name" value={field.value} onChange={field.onChange} />
                  <div className="text-destructive min-h-[1.25rem] text-sm font-normal">
                    {fieldState.error?.message}
                  </div>
                </FieldContent>
              </Field>
            )}
          />
          <div className="flex w-full items-center justify-end gap-x-4">
            <DialogClose asChild>
              <Button variant={"outline"} type="button" disabled={isCreatingCategory}>
                {t("cancel")}
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isCreatingCategory || !form.formState.isValid}>
              {isCreatingCategory ? <Spinner /> : t("submit")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
