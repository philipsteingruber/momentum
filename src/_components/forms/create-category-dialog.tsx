import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldContent, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useDialogState } from "@/hooks/use-dialog-state";
import { createCategorySchema } from "@/lib/schemas";
import { trpc } from "@/trpc/client";
import { zodResolver } from "@hookform/resolvers/zod";
import { PlusIcon } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import type z from "zod";

export const CreateCategoryDialog = () => {
  const trpcUtils = trpc.useUtils();
  const { mutate: createCategory, isPending: isCreatingCategory } = trpc.category.create.useMutation({
    onSuccess: () => {
      toast.success("Category Created");
      trpcUtils.category.getAll.invalidate();
      setIsOpen(false);
    },
  });

  const { handleOpenChange, isOpen, setIsOpen } = useDialogState({
    preventClose: isCreatingCategory,
    onClose: () => form.reset(),
  });

  const form = useForm<z.infer<typeof createCategorySchema>>({
    resolver: zodResolver(createCategorySchema),
    defaultValues: { name: "" },
    mode: "all",
  });

  const onSubmit = (data: z.infer<typeof createCategorySchema>) => {
    createCategory(data);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="flex items-center justify-between">
          <PlusIcon />
          Add
        </Button>
      </DialogTrigger>
      <DialogContent className="w-full">
        <DialogHeader>
          <DialogTitle>New Category</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="w-full">
          <Controller
            name="name"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field aria-invalid={fieldState.invalid} orientation={"horizontal"} className="flex w-full">
                <FieldLabel htmlFor="name" className="mt-1.5 w-10 flex-none!">
                  Name
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
          <Controller
            name="color"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field aria-invalid={fieldState.invalid} orientation={"horizontal"} className="flex w-full items-center">
                <FieldLabel htmlFor="color" className="mt-1.5 w-10 flex-none!">
                  Color
                </FieldLabel>
                <FieldContent>
                  <Input
                    value={field.value}
                    onChange={field.onChange}
                    id="color"
                    className="size-10 p-0"
                    type="color"
                  />
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
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isCreatingCategory || !form.formState.isValid}>
              {isCreatingCategory ? <Spinner /> : "Submit"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
