import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import type { Task } from "@/generated/prisma/client";
import { TaskStatus } from "@/generated/prisma/enums";
import { useFormatInUserTz } from "@/hooks/use-format-in-user-tz";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { KanbanCardContentReadonly } from "./kanban-card-content-readonly";

const KanbanColumnReadonly = ({
  tasks,
  status,
  isPending,
  grantorId,
}: {
  tasks: Task[];
  status: TaskStatus;
  isPending: boolean;
  grantorId: string;
}) => {
  const t = useTranslations("KanbanBoard");
  const tStatus = useTranslations("TaskStatus");
  const { isOverdue } = useFormatInUserTz();

  return (
    <div className="flex h-[1000px] w-[400px] flex-col items-center">
      <span className="w-full text-center">{tStatus(status)}</span>
      <div className="flex h-full w-full overflow-hidden rounded border-2">
        <div className="flex w-full flex-col gap-y-4 overflow-y-auto p-4 [scrollbar-gutter:stable]">
          {isPending ? (
            <Spinner />
          ) : tasks.length > 0 ? (
            tasks.map((task) => (
              <Card
                key={task.id}
                className={cn(
                  "border-primary h-[200px] w-full border",
                  task.dueDate &&
                    isOverdue(task.dueDate) &&
                    task.status !== TaskStatus.CANCELLED &&
                    task.status !== TaskStatus.COMPLETED &&
                    "bg-red-500/30",
                )}
              >
                <KanbanCardContentReadonly task={task} grantorId={grantorId} />
              </Card>
            ))
          ) : (
            t("noTasks")
          )}
        </div>
      </div>
    </div>
  );
};

export default KanbanColumnReadonly;
