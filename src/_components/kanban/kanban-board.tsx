import { Card } from "@/components/ui/card";
import { TaskStatus } from "@/generated/prisma/enums";
import type { TaskWithTags } from "@/lib/types/task";
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { useState } from "react";
import { KanbanCardContent } from "./kanban-card-content";
import KanbanColumn from "./kanban-column";

export const KanbanBoard = ({
  tasks,
  isPending,
  updateTaskStatus,
}: {
  tasks: TaskWithTags[];
  isPending: boolean;
  updateTaskStatus: ({ taskId, newStatus }: { taskId: string; newStatus: TaskStatus }) => void;
}) => {
  const [activeTask, setActiveTask] = useState<TaskWithTags | null>(null);

  const keyboardSensor = useSensor(KeyboardSensor);
  const pointerSensor = useSensor(PointerSensor, { activationConstraint: { delay: 10, tolerance: 5 } });
  const sensors = useSensors(keyboardSensor, pointerSensor);

  const tasksByStatus: Record<TaskStatus, TaskWithTags[]> = tasks.reduce(
    (groups, task) => {
      groups[task.status].push(task);
      return groups;
    },
    { PENDING: [], IN_PROGRESS: [], BLOCKED: [], COMPLETED: [], CANCELLED: [] } as Record<TaskStatus, TaskWithTags[]>,
  );

  return (
    <DndContext
      onDragStart={({ active }) => setActiveTask(tasks.find((task) => task.id === active.id) ?? null)}
      onDragEnd={({ active, over }) => {
        setActiveTask(null);
        if (!over) return;

        const validStatuses = Object.values(TaskStatus);
        const targetStatus = validStatuses.includes(over.id as TaskStatus)
          ? (over.id as TaskStatus)
          : tasks.find((t) => t.id === over.id)?.status;

        if (!targetStatus || activeTask?.status === targetStatus) return;

        const task = tasks.find((task) => task.id === active.id);
        if (!task) {
          console.error("Drag/Drop Error");
          return;
        }
        updateTaskStatus({ taskId: task.id, newStatus: targetStatus });
      }}
      onDragCancel={() => setActiveTask(null)}
      sensors={sensors}
    >
      <div className="flex gap-x-4">
        {(Object.keys(tasksByStatus) as TaskStatus[]).map((status) => (
          <KanbanColumn key={status} tasks={tasksByStatus[status]} status={status} isPending={isPending} />
        ))}
      </div>
      {activeTask && (
        <DragOverlay>
          <Card className="h-[150px]">
            <KanbanCardContent task={activeTask} />
          </Card>
        </DragOverlay>
      )}
    </DndContext>
  );
};
