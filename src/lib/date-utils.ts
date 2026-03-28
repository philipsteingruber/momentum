import type { Locale } from "date-fns";
import { addDays, formatRelative, isBefore, startOfDay } from "date-fns";
import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";
import { enUS, sv } from "date-fns/locale";

export const DEFAULT_TIMEZONE = "Europe/Stockholm";

type RelativeTokenMap = {
  lastWeek: string;
  yesterday: string;
  today: string;
  tomorrow: string;
  nextWeek: string;
  other: string;
};

const relativeTokens: Record<string, RelativeTokenMap> = {
  en: {
    lastWeek: "'last' eeee",
    yesterday: "'yesterday'",
    today: "'today'",
    tomorrow: "'tomorrow'",
    nextWeek: "eeee",
    other: "MM/dd/yyyy",
  },
  sv: {
    lastWeek: "'förra' eeee'en'",
    yesterday: "'igår'",
    today: "'idag'",
    tomorrow: "'imorgon'",
    nextWeek: "eeee",
    other: "yyyy-MM-dd",
  },
};

const dateFnsLocales: Record<string, Locale> = {
  en: enUS,
  sv,
};

export function getDateLocale(locale: string): Locale {
  const tokens = relativeTokens[locale] ?? relativeTokens["en"]!;
  const base = dateFnsLocales[locale] ?? enUS;
  return {
    ...base,
    formatRelative: (token: keyof RelativeTokenMap) => tokens[token],
  };
}

// Kept for backwards compatibility at call sites that pass a pre-built locale object
export const dateOnlyLocale = getDateLocale("en");

export function formatInUserTz(date: Date, fmt: string, timezone: string): string {
  return formatInTimeZone(date, timezone, fmt);
}

function startOfDayInTz(date: Date, timezone: string): Date {
  return startOfDay(toZonedTime(date, timezone));
}

export function isOverdueInUserTz(dueDate: Date, timezone: string): boolean {
  return isBefore(startOfDayInTz(dueDate, timezone), startOfDayInTz(new Date(), timezone));
}

export function computeSnoozeDueDate(currentDueDate: Date, days: number, timezone: string): Date {
  const startOfTodayInTz = startOfDayInTz(new Date(), timezone);
  const anchor = isBefore(startOfDayInTz(currentDueDate, timezone), startOfTodayInTz)
    ? fromZonedTime(startOfTodayInTz, timezone)
    : currentDueDate;
  return addDays(anchor, days);
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
