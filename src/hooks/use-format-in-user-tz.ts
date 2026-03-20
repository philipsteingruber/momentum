import { DEFAULT_TIMEZONE, formatInUserTz, formatRelativeInUserTz, getDateLocale, isOverdueInUserTz } from "@/lib/date-utils";
import { trpc } from "@/trpc/client";

export function useFormatInUserTz() {
  const { data: settings } = trpc.userSettings.get.useQuery();
  const timezone = settings?.timezone ?? DEFAULT_TIMEZONE;
  const dateLocale = getDateLocale(settings?.locale ?? "en");

  return {
    fmt: (date: Date, formatStr: string) => formatInUserTz(date, formatStr, timezone),
    fmtRelative: (date: Date) =>
      formatRelativeInUserTz(date, timezone, { locale: dateLocale, weekStartsOn: 1 }),
    isOverdue: (dueDate: Date) => isOverdueInUserTz(dueDate, timezone),
  };
}
