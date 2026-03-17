"use client";

import { EmptyCard } from "@/_components/cards/empty-card";
import { ErrorCard } from "@/_components/cards/error-card";
import { LoadingCard } from "@/_components/cards/loading-card";
import { MaxWidthWrapper } from "@/_components/max-width-wrapper";
import { UpdateTaskDialog } from "@/_components/task/update-task-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { TaskStatus } from "@/generated/prisma/enums";
import { useDialogState } from "@/hooks/use-dialog-state";
import { useFormatInUserTz } from "@/hooks/use-format-in-user-tz";
import { capitaliseFirstCharacter, parseTaskStatus } from "@/lib/task-utils";
import { trpc } from "@/trpc/client";
import { differenceInDays } from "date-fns";
import { CalendarIcon, CheckIcon, FileIcon, LinkIcon, TrashIcon, UserIcon, WorkflowIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useState } from "react";
import { toast } from "sonner";

const Page = ({ params }: { params: Promise<{ taskId: string }> }) => {
  const { taskId } = use(params);
  const t = useTranslations("TaskDetailPage");

  const trpcUtils = trpc.useUtils();
  const router = useRouter();

  const { data: task, isPending: isLoadingTask, isError, error } = trpc.task.getById.useQuery({ taskId });
  const { data: categories } = trpc.category.getAll.useQuery();

  const { mutate: createNote, isPending: isCreatingNote } = trpc.note.create.useMutation({
    onSuccess: () => {
      toast.success(t("noteCreatedToast"));
      setNoteValue("");
      trpcUtils.task.getById.invalidate({ taskId });
    },
  });
  const { mutate: updateTaskStatus, isPending: isUpdatingStatus } = trpc.task.updateStatus.useMutation({
    onSuccess: (data) => {
      toast.success(t("statusUpdatedToast", { status: parseTaskStatus(data.status) }));
      trpcUtils.task.getById.invalidate({ taskId });
      trpcUtils.category.getAll.invalidate();
    },
  });
  const { mutate: deleteTask, isPending: isDeletingTask } = trpc.task.delete.useMutation({
    onSuccess: () => {
      toast.success(t("deletedToast"));
      trpcUtils.task.getAll.invalidate();
      trpcUtils.category.getAll.invalidate();
      setIsOpen(false);
      router.push("/");
    },
  });
  const { mutate: snoozeTask, isPending: isSnoozingTask } = trpc.task.snooze.useMutation({
    onSuccess: (_data, variables) => {
      toast.success(t("snoozedToast", { days: variables.days }));
      trpcUtils.task.getAll.invalidate();
      trpcUtils.task.getById.invalidate({ taskId });
      trpcUtils.category.getAll.invalidate();
    },
  });

  const isMutationRunning = isCreatingNote || isDeletingTask || isSnoozingTask;
  const [noteValue, setNoteValue] = useState<string>("");
  const { handleOpenChange, isOpen, setIsOpen } = useDialogState({ preventClose: isDeletingTask });
  const { fmt, fmtRelative } = useFormatInUserTz();

  if (isError) {
    return (
      <MaxWidthWrapper>
        <ErrorCard className="w-full" title={t("cardTitle")} error={error.message} />
      </MaxWidthWrapper>
    );
  }
  if (isLoadingTask) {
    return (
      <MaxWidthWrapper>
        <LoadingCard className="w-full" title={t("cardTitle")} />
      </MaxWidthWrapper>
    );
  }
  if (!task) {
    return (
      <MaxWidthWrapper>
        <EmptyCard className="w-full" title={t("cardTitle")} />
      </MaxWidthWrapper>
    );
  }

  return (
    <MaxWidthWrapper>
      <Card className="w-full">
        <CardHeader>
          <CardTitle>{task.title}</CardTitle>
          <CardDescription>{task.description}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-y-4">
          <div className="flex items-center gap-x-2">
            <WorkflowIcon />{" "}
            <Select
              onValueChange={(val) => updateTaskStatus({ taskId, newStatus: val as TaskStatus })}
              value={task.status}
            >
              <SelectTrigger>
                <SelectValue placeholder={parseTaskStatus(task.status)} />
              </SelectTrigger>
              <SelectContent>
                {Object.keys(TaskStatus).map((choice) => (
                  <SelectItem key={choice} value={choice}>
                    {parseTaskStatus(choice as TaskStatus)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isUpdatingStatus && <Spinner />}
          </div>
          {task.category && (
            <div className="flex items-center gap-x-2">
              <FileIcon />
              {task.category.name}
            </div>
          )}
          {task.dueDate && (
            <div className="flex items-center gap-x-2">
              <CalendarIcon />
              {`${fmt(task.dueDate, "yyyy-MM-dd")}${Math.abs(differenceInDays(task.dueDate, new Date())) < 7 ? ` (${capitaliseFirstCharacter(fmtRelative(task.dueDate))})` : ""}`}
            </div>
          )}
          {task.externalContact && (
            <div className="flex items-center gap-x-2">
              <UserIcon />
              {task.externalContact}
            </div>
          )}
          {task.link && (
            <div className="flex items-center gap-x-2">
              <LinkIcon />
              <Link href={task.link} className="hover:underline">
                {task.link}
              </Link>
            </div>
          )}
          <div className="flex items-center gap-x-4">
            <Dialog open={isOpen} onOpenChange={handleOpenChange}>
              <DialogTrigger asChild>
                <Button variant={"destructive"} disabled={isMutationRunning}>
                  <TrashIcon />
                  {t("delete")}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("deleteDialogTitle")}</DialogTitle>
                  <DialogDescription>{t("deleteDialogDescription", { count: task.notes.length })}</DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant={"outline"}>{t("back")}</Button>
                  </DialogClose>
                  <Button onClick={() => deleteTask({ taskId })} disabled={isMutationRunning} variant={"destructive"}>
                    {isDeletingTask ? <Spinner /> : t("confirm")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <UpdateTaskDialog categories={categories ?? []} task={task} />
            <Button
              onClick={() => updateTaskStatus({ taskId, newStatus: TaskStatus.COMPLETED })}
              disabled={isUpdatingStatus}
            >
              {isUpdatingStatus ? (
                <Spinner />
              ) : (
                <div className="flex items-center gap-x-2">
                  <CheckIcon />
                  {t("complete")}
                </div>
              )}
            </Button>
            {task.dueDate && (
              <>
                <Button onClick={() => snoozeTask({ taskId, days: 1 })} disabled={isMutationRunning} className="w-30">
                  {isSnoozingTask ? <Spinner /> : t("snooze1Day")}
                </Button>
                <Button onClick={() => snoozeTask({ taskId, days: 3 })} disabled={isMutationRunning} className="w-30">
                  {isSnoozingTask ? <Spinner /> : t("snooze3Days")}
                </Button>
                <Button onClick={() => snoozeTask({ taskId, days: 7 })} disabled={isMutationRunning} className="w-30">
                  {isSnoozingTask ? <Spinner /> : t("snooze7Days")}
                </Button>
              </>
            )}
          </div>
          <Separator className="mt-4 mb-2" />
          <div className="flex flex-col gap-y-2">
            <div className="flex items-start gap-x-4 rounded border p-2">
              <Textarea
                value={noteValue}
                onChange={(e) => setNoteValue(e.target.value)}
                className="flex-1 resize-none"
              />
              <Button
                disabled={isMutationRunning || noteValue.trim() === ""}
                onClick={() => createNote({ content: noteValue, taskId })}
                className="w-40"
              >
                {isCreatingNote ? <Spinner /> : t("addNote")}
              </Button>
            </div>
            {task.notes.map((note) => (
              <div key={note.id} className="flex items-start gap-x-4 rounded border p-2">
                <Textarea value={note.content} className="flex-1 resize-none" readOnly />
                <div className="flex w-40 items-center gap-x-2">
                  <CalendarIcon />
                  <span className="truncate">{capitaliseFirstCharacter(fmtRelative(note.createdAt))}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </MaxWidthWrapper>
  );
};

export default Page;
