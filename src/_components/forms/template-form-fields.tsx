"use client";

import { CategorySelect } from "@/_components/category-select";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import type { Category } from "@/generated/prisma/client";
import { RecurrenceType } from "@/generated/prisma/enums";
import { DAY_OF_MONTH_OPTIONS, DAY_OF_WEEK_OPTIONS } from "@/lib/recurring-template-utils";
import { capitaliseFirstCharacter } from "@/lib/task-utils";
import { Controller, type Control, type FieldValues, type Path } from "react-hook-form";

interface TemplateFieldLabels {
  titleLabel: string;
  titlePlaceholder: string;
  descriptionLabel: string;
  descriptionPlaceholder: string;
  recurrenceTypeLabel: string;
  recurrenceTypePlaceholder: string;
  onEveryLabel: string;
  dayOfMonthPlaceholder: string;
  dayOfWeekPlaceholder: string;
  categoryLabel: string;
  categoryPlaceholder: string;
  externalContactLabel: string;
  externalContactPlaceholder: string;
  externalLinkLabel: string;
  externalLinkPlaceholder: string;
}

interface TemplateFormFieldsProps<T extends FieldValues> {
  control: Control<T>;
  prefix: "" | "data.";
  categories: Category[];
  labels: TemplateFieldLabels;
  selectedRecurrenceType: RecurrenceType | undefined;
  /** Optional suffix for field IDs, used when multiple template forms are shown at once */
  idSuffix?: string;
  autoFocus?: boolean;
}

export function TemplateFormFields<T extends FieldValues>({
  control,
  prefix,
  categories,
  labels,
  selectedRecurrenceType,
  idSuffix = "",
  autoFocus,
}: TemplateFormFieldsProps<T>) {
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
        <div className="flex items-center gap-x-4">
          <Controller
            name={field("recurrenceType")}
            control={control}
            render={({ field: f, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel>{labels.recurrenceTypeLabel}</FieldLabel>
                <Select value={f.value as string} onValueChange={f.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder={labels.recurrenceTypePlaceholder} />
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
              name={field("dayOfMonth")}
              control={control}
              render={({ field: f, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel>{labels.onEveryLabel}</FieldLabel>
                  <Select
                    value={(f.value as number | undefined)?.toString()}
                    onValueChange={(val) => f.onChange(Number(val))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={labels.dayOfMonthPlaceholder} />
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
              name={field("dayOfWeek")}
              control={control}
              render={({ field: f, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel>{labels.onEveryLabel}</FieldLabel>
                  <Select
                    value={(f.value as number | undefined)?.toString()}
                    onValueChange={(val) => f.onChange(Number(val))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={labels.dayOfWeekPlaceholder} />
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
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
      </FieldGroup>
    </>
  );
}
