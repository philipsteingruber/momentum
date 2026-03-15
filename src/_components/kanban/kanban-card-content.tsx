import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TaskStatus } from "@/generated/prisma/enums";
import { dateOnlyLocale } from "@/lib/date-utils";
import type { TaskWithTags } from "@/lib/types/task";
import { cn } from "@/lib/utils";
import { formatRelative, isAfter } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useRouter } from "next/navigation";

export const KanbanCardContent = ({ task }: { task: TaskWithTags }) => {
  const router = useRouter();

  return (
    <>
      <CardHeader>
        <CardTitle
          onClick={() => router.push(`/task/${task.id}`)}
          onPointerDown={(e) => e.stopPropagation()}
          className="line-clamp-1 cursor-pointer underline decoration-dashed decoration-1 hover:decoration-solid"
        >
          {task.title}
        </CardTitle>
        <CardDescription className="line-clamp-2">{task.description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-y-4">
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
      </CardContent>
    </>
  );
};
