import { Badge } from "@/components/ui/badge";
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
        <CardDescription>{task.description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-y-4">
        <Tooltip>
          <TooltipTrigger className="flex items-center gap-x-2">
            <CalendarIcon />
            {task.dueDate && (
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
            )}
          </TooltipTrigger>
          <TooltipContent>Due Date</TooltipContent>
        </Tooltip>
        <div className="flex flex-wrap gap-x-2">
          {task.tags.map((tag) => (
            <Badge key={tag.id} className="text-primary-foreground" style={{ background: tag.color ?? "#6366f1" }}>
              {tag.name}
            </Badge>
          ))}
        </div>
      </CardContent>
    </>
  );
};
