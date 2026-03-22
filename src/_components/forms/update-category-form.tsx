"use client";

import { ConfirmDeleteDialog } from "@/_components/confirm-delete-dialog";
import { Button } from "@/components/ui/button";
import { Field, FieldContent, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import type { Category } from "@/generated/prisma/client";
import { makeUpdateCategorySchema } from "@/lib/schemas";
import { trpc } from "@/trpc/client";
import { zodResolver } from "@hookform/resolvers/zod";
import { PaintBucketIcon, TagIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import type z from "zod";

export const UpdateCategoryForm = ({ category }: { category: Category }) => {
  const t = useTranslations("UpdateCategoryForm");
  const tSchemas = useTranslations("Schemas");
  const schema = makeUpdateCategorySchema({
    nameRequired: tSchemas("nameRequired"),
    nameMaxLength: tSchemas("nameMaxLength"),
  });
  const trpcUtils = trpc.useUtils();
  const { mutate: updateCategory, isPending: isUpdatingCategory } = trpc.category.update.useMutation({
    onSuccess: () => {
      toast.success(t("updatedToast"));
      trpcUtils.category.getAll.invalidate();
    },
  });
  const { mutate: deleteCategory, isPending: isDeletingCategory } = trpc.category.delete.useMutation({
    onSuccess: () => {
      toast.success(t("deletedToast"));
      trpcUtils.category.getAll.invalidate();
    },
  });

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      categoryId: category.id,
      data: {
        name: category.name,
        color: category.color ?? undefined,
      },
    },
    mode: "all",
  });

  const onSubmit = (data: z.infer<typeof schema>) => {
    updateCategory(data);
  };

  return (
    <form id="updateCategory" onSubmit={form.handleSubmit(onSubmit)} className="mt-2 flex flex-col gap-y-4">
      <Controller
        name="data.name"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid} orientation={"horizontal"} className="w-full">
            <FieldLabel htmlFor="name" className="mt-1 flex-none!">
              <TagIcon />
            </FieldLabel>
            <FieldContent>
              <Input value={field.value} onChange={field.onChange} id="name" className="w-1/2" />
              <div className="text-destructive min-h-[1.25rem] text-sm font-normal">{fieldState.error?.message}</div>
            </FieldContent>
          </Field>
        )}
      />
      <Controller
        name="data.color"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid} orientation={"horizontal"} className="w-full">
            <FieldLabel htmlFor="color" className="mt-1 flex-none!">
              <PaintBucketIcon />
            </FieldLabel>
            <FieldContent>
              <Input value={field.value} onChange={field.onChange} id="color" className="size-10 p-0" type="color" />
              <div className="text-destructive min-h-[1.25rem] text-sm font-normal">{fieldState.error?.message}</div>
            </FieldContent>
          </Field>
        )}
      />
      <div className="flex w-full items-center justify-end gap-x-4 pr-4">
        <Button disabled={isUpdatingCategory} onClick={() => form.reset()} variant={"outline"} type="button">
          {t("reset")}
        </Button>
        <ConfirmDeleteDialog
          trigger={<Button variant={"destructive"}>{t("delete")}</Button>}
          title={t("deleteDialogTitle")}
          description={t("deleteDialogDescription")}
          cancelLabel={t("back")}
          confirmLabel={t("confirm")}
          onConfirm={() => deleteCategory({ categoryId: category.id })}
          isPending={isDeletingCategory}
        />
        <Button disabled={isUpdatingCategory || !form.formState.isValid || !form.formState.isDirty} type="submit">
          {isUpdatingCategory ? <Spinner /> : t("submit")}
        </Button>
      </div>
    </form>
  );
};
