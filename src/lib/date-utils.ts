import { formatInTimeZone, toZonedTime } from "date-fns-tz";
import { formatRelative, isBefore, startOfDay } from "date-fns";
import { enUS } from "date-fns/locale";

const dateOnlyRelativeLocale = {
  lastWeek: "'last' eeee",
  yesterday: "'yesterday'",
  today: "'today'",
  tomorrow: "'tomorrow'",
  nextWeek: "eeee",
  other: "MM/dd/yyyy",
} as const;

export const dateOnlyLocale = {
  ...enUS,
  formatRelative: (token: keyof typeof dateOnlyRelativeLocale) => dateOnlyRelativeLocale[token],
};

export function formatInUserTz(date: Date, fmt: string, timezone: string): string {
  return formatInTimeZone(date, timezone, fmt);
}

export function isOverdueInUserTz(dueDate: Date, timezone: string): boolean {
  const startOfDueDay = startOfDay(toZonedTime(dueDate, timezone));
  const startOfToday = startOfDay(toZonedTime(new Date(), timezone));
  return isBefore(startOfDueDay, startOfToday);
}

export function formatRelativeInUserTz(
  date: Date,
  timezone: string,
  options?: Parameters<typeof formatRelative>[2],
): string {
  const zonedDate = toZonedTime(date, timezone);
  const zonedNow = toZonedTime(new Date(), timezone);
  return formatRelative(zonedDate, zonedNow, options);
}
