"use client";

import { MaxWidthWrapper } from "@/_components/max-width-wrapper";
import { QueryState } from "@/_components/query-state";
import { StatusBadge } from "@/_components/status-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useFormatInUserTz } from "@/hooks/use-format-in-user-tz";
import { capitaliseFirstCharacter } from "@/lib/task-utils";
import { trpc } from "@/trpc/client";
import { useTranslations } from "next-intl";
import { differenceInDays } from "date-fns";
import { CalendarIcon, FileIcon, LinkIcon, UserIcon, WorkflowIcon } from "lucide-react";
import Link from "next/link";
import { use } from "react";

const Page = ({ params }: { params: Promise<{ userId: string; taskId: string }> }) => {
  const { userId, taskId } = use(params);
  const t = useTranslations("SharedView");
  const { fmt, fmtRelative } = useFormatInUserTz();

  const {
    data: task,
    isPending,
    isError,
    error,
  } = trpc.sharedAccess.getTaskByIdForGrantor.useQuery({ grantorId: userId, taskId });

  return (
    <QueryState isPending={isPending} isError={isError} error={error} isEmpty={!task} title={t("cardTitle")}>
      {task && (
        <MaxWidthWrapper>
          <Card className="w-full">
            <CardHeader>
              <CardTitle>{task.title}</CardTitle>
              <CardDescription>{task.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-y-4">
              <div className="flex items-center gap-x-2">
                <WorkflowIcon />
                <StatusBadge task={task} />
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
              <div className="flex items-center gap-x-2">
                <Link href={`/shared/${userId}`} className="text-muted-foreground text-sm hover:underline">
                  ← {t("back")}
                </Link>
              </div>
              <Separator className="mt-4 mb-2" />
              <div className="flex flex-col gap-y-2">
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
      )}
    </QueryState>
  );
};

export default Page;
