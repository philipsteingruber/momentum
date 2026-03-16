import { Spinner } from "@/components/ui/spinner";
import type { Task, TaskStatus } from "@/generated/prisma/client";
import { parseTaskStatus } from "@/lib/task-utils";
import { cn } from "@/lib/utils";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import KanbanCard from "./kanban-card";

const KanbanColumn = ({ tasks, status, isPending }: { tasks: Task[]; status: TaskStatus; isPending: boolean }) => {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div className="flex h-[1000px] w-[400px] flex-col items-center">
      <span className="w-full text-center">{parseTaskStatus(status)}</span>
      <div
        className={cn(
          "flex h-full w-full flex-col gap-y-4 rounded border-2 p-4",
          isOver && "border-primary bg-gray-800",
        )}
        ref={setNodeRef}
      >
        <SortableContext items={tasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
          {isPending ? (
            <Spinner />
          ) : tasks.length > 0 ? (
            tasks.map((task) => <KanbanCard key={task.id} task={task} />)
          ) : (
            "No tasks"
          )}
        </SortableContext>
      </div>
    </div>
  );
};

export default KanbanColumn;
