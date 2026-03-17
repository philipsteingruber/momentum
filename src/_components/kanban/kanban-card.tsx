import { Card } from "@/components/ui/card";
import type { Task } from "@/generated/prisma/client";
import { TaskStatus } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useFormatInUserTz } from "@/hooks/use-format-in-user-tz";
import { KanbanCardContent } from "./kanban-card-content";

const KanbanCard = ({ task }: { task: Task }) => {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({ id: task.id });
  const { isOverdue } = useFormatInUserTz();

  return (
    <div
      className="flex w-full cursor-pointer flex-col items-center"
      ref={setNodeRef}
      {...attributes}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <Card
        {...listeners}
        className={cn(
          "border-primary h-[200px] w-full border",
          isDragging ? "opacity-40" : "opacity-100",
          task.dueDate &&
            isOverdue(task.dueDate) &&
            task.status !== TaskStatus.CANCELLED &&
            task.status !== TaskStatus.COMPLETED &&
            "bg-red-500/30",
        )}
      >
        <KanbanCardContent task={task} />
      </Card>
    </div>
  );
};

export default KanbanCard;
