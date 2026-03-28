"use client";

import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { TaskStatus } from "@/generated/prisma/enums";
import { useFormatInUserTz } from "@/hooks/use-format-in-user-tz";
import { trpc } from "@/trpc/client";
import { useTranslations } from "next-intl";

type HistoryBadgeVariant = "completed" | "cancelled" | "secondary";

const historyBadgeVariant = (status: TaskStatus): HistoryBadgeVariant => {
  if (status === TaskStatus.COMPLETED) return "completed";
  if (status === TaskStatus.CANCELLED) return "cancelled";
  return "secondary";
};

export const TemplateHistory = ({ templateId, snoozeCount }: { templateId: string; snoozeCount: number }) => {
  const t = useTranslations("TemplateHistory");
  const tStatus = useTranslations("TaskStatus");
  const { fmt } = useFormatInUserTz();
  const { data, isPending, isError } = trpc.recurringTemplate.getHistory.useQuery({ templateId });

  return (
    <>
      <Separator className="mt-4" />
      <div className="mt-4 flex flex-col gap-y-2 px-4 pb-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-muted-foreground">{t("heading")}</h3>
          {snoozeCount > 0 && (
            <span className="text-xs text-muted-foreground">{t("snoozeCount", { count: snoozeCount })}</span>
          )}
        </div>
        {isPending && <Spinner />}
        {isError && <p className="text-sm text-destructive">{t("error")}</p>}
        {!isPending && !isError && data.length === 0 && (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        )}
        {data?.map((entry) => (
          <div key={entry.id} className="flex items-center justify-between text-sm">
            <span>{entry.dueDate ? fmt(entry.dueDate, "PPP") : "—"}</span>
            <Badge variant={historyBadgeVariant(entry.status)}>{tStatus(entry.status)}</Badge>
          </div>
        ))}
      </div>
    </>
  );
};
