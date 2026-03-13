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
