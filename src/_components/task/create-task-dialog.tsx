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
import { createTaskSchema } from "@/lib/schemas";
import { trpc } from "@/trpc/client";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { CalendarIcon, PlusIcon } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import type z from "zod";

const CreateTaskDialog = ({ categories }: { categories: Category[] }) => {
  const form = useForm<z.infer<typeof createTaskSchema>>({
    resolver: zodResolver(createTaskSchema),
    defaultValues: {
      title: "",
      description: "",
    },
    mode: "onBlur",
  });
  const [datePickerOpen, setDatePickerOpen] = useState<boolean>(false);
  const trpcUtils = trpc.useUtils();

  const { mutate: createTask, isPending: isCreatingTask } = trpc.task.create.useMutation({
    onSuccess: () => {
      toast.success("Successfully created task");
      setIsOpen(false);
      form.reset();
      trpcUtils.task.getAll.invalidate();
    },
  });
  const { isOpen, setIsOpen, handleOpenChange } = useDialogState({
    preventClose: isCreatingTask,
    onClose: () => form.reset(),
  });

  const onSubmit = (data: z.infer<typeof createTaskSchema>) => {
    createTask(data);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="flex items-center gap-x-2">
          <PlusIcon /> Add
        </Button>
      </DialogTrigger>
      <DialogContent onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Create Task</DialogTitle>
          <DialogDescription>Fill in the fields below and click Submit to create a new task</DialogDescription>
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
            <Controller
              name="dueDate"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel>Due Date</FieldLabel>
                  <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                    <PopoverTrigger asChild>
                      <Button>
                        <CalendarIcon /> {field.value ? format(field.value, "yyyy-MM-dd") : "Pick a due date"}
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
                  <FieldLabel htmlFor="link">External Contact</FieldLabel>
                  <Input
                    {...field}
                    id="link"
                    aria-invalid={fieldState.invalid}
                    placeholder="Enter any External Links"
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
            <Button type="submit" disabled={!form.formState.isValid || isCreatingTask}>
              {isCreatingTask ? <Spinner /> : "Submit"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateTaskDialog;
