import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { TaskStatus } from "@/generated/prisma/enums";
import { dateOnlyLocale } from "@/lib/date-utils";
import type { TaskWithTags } from "@/lib/types/task";
import { cn } from "@/lib/utils";
import { formatRelative, isAfter } from "date-fns";
import { CalendarIcon } from "lucide-react";

export const KanbanCardContent = ({ task }: { task: TaskWithTags }) => {
  return (
    <>
      <CardHeader>
        <CardTitle>{task.title}</CardTitle>
        <CardDescription className="line-clamp-2">{task.description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-y-4">
        <Tooltip>
          <TooltipTrigger className="flex items-center gap-x-2">
            {task.dueDate && (
              <div className="flex items-center gap-x-2">
                <CalendarIcon />
                <span
                  className={cn(
                    isAfter(new Date(), task.dueDate) &&
                      task.status !== TaskStatus.CANCELLED &&
                      task.status !== TaskStatus.COMPLETED &&
                      "text-red-200",
                  )}
                >
                  {formatRelative(task.dueDate, new Date(), { locale: dateOnlyLocale, weekStartsOn: 1 })}
                </span>
              </div>
            )}
          </TooltipTrigger>
          <TooltipContent align="start">Due Date</TooltipContent>
        </Tooltip>
      </CardContent>
    </>
  );
};
