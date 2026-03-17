import { formatInUserTz, formatRelativeInUserTz, isOverdueInUserTz } from "@/lib/date-utils";
import { trpc } from "@/trpc/client";
import type { formatRelative } from "date-fns";

export function useFormatInUserTz() {
  const { data: settings } = trpc.userSettings.get.useQuery();
  const timezone = settings?.timezone ?? "Europe/Stockholm";
  return {
    fmt: (date: Date, formatStr: string) => formatInUserTz(date, formatStr, timezone),
    fmtRelative: (date: Date, options?: Parameters<typeof formatRelative>[2]) =>
      formatRelativeInUserTz(date, timezone, options),
    isOverdue: (dueDate: Date) => isOverdueInUserTz(dueDate, timezone),
  };
}
