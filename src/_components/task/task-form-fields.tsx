"use client";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import type { Category } from "@/generated/prisma/client";
import { CalendarIcon } from "lucide-react";
import { useState } from "react";
import { Controller, type Control, type FieldValues, type Path } from "react-hook-form";
import { CategorySelect } from "@/_components/category-select";

interface TaskFieldLabels {
  titleLabel: string;
  titlePlaceholder: string;
  descriptionLabel: string;
  descriptionPlaceholder: string;
  dueDateLabel: string;
  dueDatePlaceholder: string;
  categoryLabel: string;
  categoryPlaceholder: string;
  externalContactLabel: string;
  externalContactPlaceholder: string;
  externalLinkLabel: string;
  externalLinkPlaceholder: string;
}

interface TaskFormFieldsProps<T extends FieldValues> {
  control: Control<T>;
  prefix: "" | "data.";
  categories: Category[];
  labels: TaskFieldLabels;
  fmt: (date: Date, format: string) => string;
  /** Optional suffix for field IDs, used when multiple task forms are shown at once */
  idSuffix?: string;
  autoFocus?: boolean;
}

export function TaskFormFields<T extends FieldValues>({
  control,
  prefix,
  categories,
  labels,
  fmt,
  idSuffix = "",
  autoFocus,
}: TaskFormFieldsProps<T>) {
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const field = <K extends string>(name: K) => (`${prefix}${name}` as Path<T>);
  const id = (name: string) => (idSuffix ? `${name}-${idSuffix}` : name);

  return (
    <>
      <FieldGroup>
        <Controller
          name={field("title")}
          control={control}
          render={({ field: f, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={id("title")}>{labels.titleLabel}</FieldLabel>
              <Input
                {...f}
                id={id("title")}
                aria-invalid={fieldState.invalid}
                placeholder={labels.titlePlaceholder}
                autoComplete="off"
                autoFocus={autoFocus}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          name={field("description")}
          control={control}
          render={({ field: f, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={id("description")}>{labels.descriptionLabel}</FieldLabel>
              <Input
                {...f}
                id={id("description")}
                aria-invalid={fieldState.invalid}
                placeholder={labels.descriptionPlaceholder}
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
          name={field("dueDate")}
          control={control}
          render={({ field: f, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel>{labels.dueDateLabel}</FieldLabel>
              <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                <PopoverTrigger asChild>
                  <Button>
                    <CalendarIcon />
                    {f.value ? fmt(f.value as Date, "yyyy-MM-dd") : labels.dueDatePlaceholder}
                  </Button>
                </PopoverTrigger>
                <PopoverContent>
                  <Calendar
                    mode="single"
                    disabled={{ before: new Date() }}
                    selected={f.value as Date | undefined}
                    defaultMonth={(f.value as Date | undefined) ?? new Date()}
                    onSelect={f.onChange}
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
          name={field("categoryId")}
          control={control}
          render={({ field: f, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel>{labels.categoryLabel}</FieldLabel>
              <CategorySelect
                value={f.value as string | undefined}
                onValueChange={f.onChange}
                categories={categories}
                placeholder={labels.categoryPlaceholder}
              />
            </Field>
          )}
        />
        <Controller
          name={field("externalContact")}
          control={control}
          render={({ field: f, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={id("externalContact")}>{labels.externalContactLabel}</FieldLabel>
              <Input
                {...f}
                id={id("externalContact")}
                aria-invalid={fieldState.invalid}
                placeholder={labels.externalContactPlaceholder}
                autoComplete="off"
              />
            </Field>
          )}
        />
        <Controller
          name={field("link")}
          control={control}
          render={({ field: f, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={id("link")}>{labels.externalLinkLabel}</FieldLabel>
              <Input
                {...f}
                id={id("link")}
                aria-invalid={fieldState.invalid}
                placeholder={labels.externalLinkPlaceholder}
                autoComplete="off"
              />
            </Field>
          )}
        />
      </FieldGroup>
    </>
  );
}
