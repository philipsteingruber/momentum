import type { TaskStatus } from "@/generated/prisma/enums";
import { isAfter } from "date-fns";

export const parseTaskStatus = (taskStatus: TaskStatus) => {
  const words = taskStatus.split("_");
  return words.map((word) => capitaliseFirstCharacter(word)).join(" ");
};

export const capitaliseFirstCharacter = (str: string) => {
  return str.length > 0 ? str[0].toUpperCase() + str.slice(1).toLowerCase() : "";
};

export const isOverdue = (dueDate: Date | null): boolean => {
  return dueDate ? isAfter(new Date(), dueDate) : false;
};
