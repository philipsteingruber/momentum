import { Spinner } from "@/components/ui/spinner";
import type { Task, TaskStatus } from "@/generated/prisma/client";
import { cn } from "@/lib/utils";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useTranslations } from "next-intl";
import KanbanCard from "./kanban-card";

const KanbanColumn = ({ tasks, status, isPending }: { tasks: Task[]; status: TaskStatus; isPending: boolean }) => {
  const t = useTranslations("KanbanBoard");
  const tStatus = useTranslations("TaskStatus");
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div className="flex h-[1000px] min-w-0 flex-1 flex-col items-center">
      <span className="w-full text-center">{tStatus(status)}</span>
      <div
        className={cn("flex h-full w-full overflow-hidden rounded border-2", isOver && "border-primary bg-gray-800")}
        ref={setNodeRef}
      >
        <div className="flex w-full flex-col gap-y-4 overflow-y-auto p-4 [scrollbar-gutter:stable]">
          <SortableContext items={tasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
            {isPending ? (
              <Spinner />
            ) : tasks.length > 0 ? (
              tasks.map((task) => <KanbanCard key={task.id} task={task} />)
            ) : (
              t("noTasks")
            )}
          </SortableContext>
        </div>
      </div>
    </div>
  );
};

export default KanbanColumn;
