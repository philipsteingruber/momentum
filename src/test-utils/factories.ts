import type { Category, RecurringTemplate, Task, User, UserSettings } from "@/generated/prisma/client";
import { RecurrenceType, TaskStatus } from "@/generated/prisma/enums";

// Auto-incrementing counter so every factory call produces a unique ID by default.
let counter = 0;
const nextId = () => `c${"x".repeat(7)}${String(++counter).padStart(17, "0")}`;

export const createMockUser = (overrides: Partial<User> = {}): User => ({
  id: nextId(),
  clerkId: `clerk_${nextId()}`,
  email: "test@example.com",
  name: "Test User",
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
  ...overrides,
});

export const createMockUserSettings = (overrides: Partial<UserSettings> = {}): UserSettings => ({
  id: nextId(),
  userId: nextId(),
  timezone: "Europe/Stockholm",
  locale: "en",
  discordId: null,
  discordDmChannelId: null,
  ...overrides,
});

export const createMockTask = (overrides: Partial<Task> = {}): Task => ({
  id: nextId(),
  title: "Mock Task",
  description: null,
  status: TaskStatus.PENDING,
  dueDate: null,
  externalContact: null,
  link: null,
  completedAt: null,
  userId: nextId(),
  blockedById: null,
  categoryId: null,
  recurringTemplateId: null,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
  ...overrides,
});

export const createMockCategory = (overrides: Partial<Category> = {}): Category => ({
  id: nextId(),
  name: "Mock Category",
  color: "#3b82f6",
  userId: nextId(),
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
  ...overrides,
});

export const createMockRecurringTemplate = (overrides: Partial<RecurringTemplate> = {}): RecurringTemplate => ({
  id: nextId(),
  title: "Mock Template",
  description: null,
  externalContact: null,
  link: null,
  recurrenceType: RecurrenceType.WEEKLY,
  dayOfWeek: 1,
  dayOfMonth: null,
  nextGenerateOn: new Date("2024-01-09"),
  snoozeCount: 0,
  userId: nextId(),
  categoryId: null,
  ...overrides,
});
