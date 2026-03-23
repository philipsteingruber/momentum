import { TaskStatus } from "@/generated/prisma/enums";
import { useFormatInUserTz } from "@/hooks/use-format-in-user-tz";
import { OVERDUE_STATUS, groupTasksByStatus, sortTasksForKanban } from "@/lib/task-utils";
import type { TaskWithTags } from "@/lib/types/task";
import KanbanColumnReadonly from "./kanban-column-readonly";

export const KanbanBoardReadonly = ({
  tasks,
  isPending,
  grantorId,
}: {
  tasks: TaskWithTags[];
  isPending: boolean;
  grantorId: string;
}) => {
  const { timezone } = useFormatInUserTz();
  const tasksByStatus = groupTasksByStatus(tasks, timezone);

  return (
    <div className="flex gap-x-4">
      {(Object.keys(tasksByStatus) as (TaskStatus | typeof OVERDUE_STATUS)[])
        .filter((status) => status !== TaskStatus.SKIPPED && status !== OVERDUE_STATUS)
        .map((status) => (
          <KanbanColumnReadonly
            key={status}
            tasks={sortTasksForKanban(tasksByStatus[status], status)}
            status={status}
            isPending={isPending}
            grantorId={grantorId}
          />
        ))}
    </div>
  );
};
