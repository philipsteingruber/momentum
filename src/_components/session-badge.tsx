import { Badge } from "@/components/ui/badge";
import type { Task } from "@/generated/prisma/client";
import { formatSessionProgress, getSessionProgress } from "@/lib/recurring-sessions";

export const SessionBadge = ({
  task,
  timesPerCycle,
}: {
  task: Pick<Task, "status" | "sessionIndex">;
  timesPerCycle: number;
}) => {
  const progress = getSessionProgress(task, timesPerCycle);
  if (!progress) return null;

  return (
    <Badge variant={progress.isComplete ? "completed" : "in_progress"}>
      {formatSessionProgress(progress)}
      {progress.isComplete && " ✓"}
    </Badge>
  );
};
