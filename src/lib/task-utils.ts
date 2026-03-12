import type { TaskStatus } from "@/generated/prisma/enums";

export const parseTaskStatus = (taskStatus: TaskStatus) => {
  const words = taskStatus.split("_");
  return words.map((word) => capitaliseFirstCharacter(word)).join(" ");
};

const capitaliseFirstCharacter = (str: string) => {
  return str[0].toUpperCase() + str.slice(1).toLowerCase();
};
