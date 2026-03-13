import { Card } from "@/components/ui/card";
import { TaskStatus } from "@/generated/prisma/enums";
import type { TaskWithTags } from "@/lib/types/task";
import { cn } from "@/lib/utils";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { isAfter } from "date-fns";
import { KanbanCardContent } from "./kanban-card-content";

const KanbanCard = ({ task }: { task: TaskWithTags }) => {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({ id: task.id });

  return (
    <div
      className="flex w-full flex-col items-center"
      ref={setNodeRef}
      {...attributes}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <Card
        {...listeners}
        className={cn(
          "w-full",
          isDragging ? "opacity-40" : "opacity-100",
          task.dueDate &&
            isAfter(new Date(), task.dueDate) &&
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
