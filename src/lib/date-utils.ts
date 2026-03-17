import type { Locale } from "date-fns";
import { formatRelative, isBefore, startOfDay } from "date-fns";
import { formatInTimeZone, toZonedTime } from "date-fns-tz";
import { enUS, sv } from "date-fns/locale";

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
