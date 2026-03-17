import { Badge } from "@/components/ui/badge";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Task } from "@/generated/prisma/client";
import { TaskStatus } from "@/generated/prisma/enums";
import { dateOnlyLocale } from "@/lib/date-utils";
import { useFormatInUserTz } from "@/hooks/use-format-in-user-tz";
import { cn } from "@/lib/utils";
import { CalendarIcon, LinkIcon, UserIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export const KanbanCardContent = ({ task }: { task: Task }) => {
  const router = useRouter();
  const { fmtRelative, isOverdue } = useFormatInUserTz();

  return (
    <>
      <CardHeader>
        <CardTitle
          onClick={() => router.push(`/task/${task.id}`)}
          onPointerDown={(e) => e.stopPropagation()}
          className="line-clamp-1 cursor-pointer text-sm underline decoration-dashed decoration-1 hover:decoration-solid"
        >
          {task.title}
        </CardTitle>
        <CardDescription className="line-clamp-2 text-sm">{task.description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-y-2">
        {task.recurringTemplateId && <Badge>Recurring</Badge>}
        {task.dueDate && (
          <div className="flex items-center gap-x-2">
            <CalendarIcon className="size-4" />
            <span
              className={cn(
                "text-sm",
                isOverdue(task.dueDate) &&
                  task.status !== TaskStatus.CANCELLED &&
                  task.status !== TaskStatus.COMPLETED &&
                  "text-red-200",
              )}
            >
              {fmtRelative(task.dueDate, { locale: dateOnlyLocale, weekStartsOn: 1 })}
            </span>
          </div>
        )}
        {task.externalContact && (
          <div className="flex items-center gap-x-2">
            <UserIcon className="size-4" />
            <span className="text-sm">{task.externalContact}</span>
          </div>
        )}
        {task.link && (
          <div className="flex items-center gap-x-2">
            <LinkIcon className="size-4" />
            <Link href={task.link} onClick={(e) => e.stopPropagation()} className="line-clamp-1 text-sm underline">
              {task.link}
            </Link>
          </div>
        )}
      </CardContent>
    </>
  );
};
