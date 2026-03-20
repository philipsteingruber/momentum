"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Category } from "@/generated/prisma/client";

interface CategorySelectProps {
  value: string | undefined;
  onValueChange: (value: string) => void;
  categories: Category[];
  placeholder: string;
}

export const CategorySelect = ({ value, onValueChange, categories, placeholder }: CategorySelectProps) => {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent position="popper">
        {categories.map((category) => (
          <SelectItem value={category.id} key={category.id}>
            {category.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
