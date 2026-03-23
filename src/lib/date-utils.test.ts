import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_TIMEZONE,
  formatInUserTz,
  formatRelativeInUserTz,
  getDateLocale,
  isOverdueInUserTz,
} from "./date-utils";

// ─── DEFAULT_TIMEZONE ─────────────────────────────────────────────────────────

describe("DEFAULT_TIMEZONE", () => {
  it("is Europe/Stockholm", () => {
    expect(DEFAULT_TIMEZONE).toBe("Europe/Stockholm");
  });
});

// ─── getDateLocale ────────────────────────────────────────────────────────────

describe("getDateLocale", () => {
  it("returns English relative tokens for 'en' locale", () => {
    const locale = getDateLocale("en");
    expect(locale.formatRelative?.("today", new Date(), new Date())).toBe("'today'");
    expect(locale.formatRelative?.("tomorrow", new Date(), new Date())).toBe("'tomorrow'");
    expect(locale.formatRelative?.("yesterday", new Date(), new Date())).toBe("'yesterday'");
  });

  it("returns Swedish relative tokens for 'sv' locale", () => {
    const locale = getDateLocale("sv");
    expect(locale.formatRelative?.("today", new Date(), new Date())).toBe("'idag'");
    expect(locale.formatRelative?.("tomorrow", new Date(), new Date())).toBe("'imorgon'");
    expect(locale.formatRelative?.("yesterday", new Date(), new Date())).toBe("'igår'");
  });

  it("falls back to English tokens for unknown locales", () => {
    const locale = getDateLocale("xx");
    expect(locale.formatRelative?.("today", new Date(), new Date())).toBe("'today'");
  });
});

// ─── formatInUserTz ───────────────────────────────────────────────────────────

describe("formatInUserTz", () => {
  it("formats a date in the given timezone", () => {
    // Noon UTC in Stockholm (UTC+2 in June) = 14:00
    const date = new Date("2024-06-15T12:00:00Z");
    expect(formatInUserTz(date, "HH:mm", "Europe/Stockholm")).toBe("14:00");
  });

  it("formats correctly in UTC", () => {
    const date = new Date("2024-06-15T12:00:00Z");
    expect(formatInUserTz(date, "HH:mm", "UTC")).toBe("12:00");
  });

  it("formats the date portion using the timezone", () => {
    // 23:00 UTC on June 15 = 01:00 June 16 in Stockholm
    const date = new Date("2024-06-15T23:00:00Z");
    expect(formatInUserTz(date, "yyyy-MM-dd", "Europe/Stockholm")).toBe("2024-06-16");
  });
});

// ─── isOverdueInUserTz ────────────────────────────────────────────────────────
// System time: Saturday 2024-06-15 10:00 UTC = 12:00 Stockholm (UTC+2)

describe("isOverdueInUserTz", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-15T10:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("returns false for a task due later today", () => {
    const laterToday = new Date("2024-06-15T20:00:00Z"); // 22:00 Stockholm, still June 15
    expect(isOverdueInUserTz(laterToday, "Europe/Stockholm")).toBe(false);
  });

  it("returns true for a task due yesterday", () => {
    const yesterday = new Date("2024-06-14T12:00:00Z");
    expect(isOverdueInUserTz(yesterday, "Europe/Stockholm")).toBe(true);
  });

  it("returns false for a task due tomorrow", () => {
    const tomorrow = new Date("2024-06-16T12:00:00Z");
    expect(isOverdueInUserTz(tomorrow, "Europe/Stockholm")).toBe(false);
  });

  it("handles the timezone day boundary correctly (UTC midnight ≠ Stockholm midnight)", () => {
    // 2024-06-14T22:00:00Z = midnight Stockholm on June 15 (today, not overdue)
    const stockholmMidnightToday = new Date("2024-06-14T22:00:00Z");
    expect(isOverdueInUserTz(stockholmMidnightToday, "Europe/Stockholm")).toBe(false);

    // One millisecond before Stockholm midnight = still June 14 Stockholm (overdue)
    const justBeforeMidnight = new Date("2024-06-14T21:59:59.999Z");
    expect(isOverdueInUserTz(justBeforeMidnight, "Europe/Stockholm")).toBe(true);
  });
});

// ─── formatRelativeInUserTz ───────────────────────────────────────────────────
// System time: Saturday 2024-06-15 10:00 UTC = 12:00 Stockholm (UTC+2)

describe("formatRelativeInUserTz", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-15T10:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("returns 'tomorrow' for a date that is tomorrow in the given timezone", () => {
    const tomorrow = new Date("2024-06-16T10:00:00Z"); // June 16 in Stockholm
    const locale = getDateLocale("en");
    expect(formatRelativeInUserTz(tomorrow, "Europe/Stockholm", { locale })).toBe("tomorrow");
  });

  it("returns 'today' for a date that is today in the given timezone", () => {
    const today = new Date("2024-06-15T14:00:00Z"); // June 15 afternoon Stockholm
    const locale = getDateLocale("en");
    expect(formatRelativeInUserTz(today, "Europe/Stockholm", { locale })).toBe("today");
  });
});
