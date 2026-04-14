import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Tailwind,
  Text,
} from "@react-email/components";
import { differenceInCalendarDays, format } from "date-fns";

export interface EmailTask {
  id: string;
  title: string;
  description: string | null;
  dueDate: Date | null;
}

export interface DailyDigestEmailProps {
  overdue: EmailTask[];
  dueToday: EmailTask[];
  dueThisWeek: { date: Date; tasks: EmailTask[] }[];
  dailyRecurring: EmailTask[];
}

const mockProps: DailyDigestEmailProps = {
  overdue: [
    {
      id: "1",
      title: "Submit Q1 report",
      description: "Finance team needs this by end of quarter",
      dueDate: new Date("2026-03-10"),
    },
  ],
  dueToday: [
    {
      id: "2",
      title: "Review pull request",
      description: null,
      dueDate: new Date(),
    },
  ],
  dueThisWeek: [
    {
      date: new Date("2026-03-18"),
      tasks: [
        {
          id: "3",
          title: "Prepare demo slides",
          description: "For the Thursday product review",
          dueDate: new Date("2026-03-18"),
        },
      ],
    },
    {
      date: new Date("2026-03-20"),
      tasks: [
        {
          id: "4",
          title: "Update documentation",
          description: null,
          dueDate: new Date("2026-03-20"),
        },
      ],
    },
  ],
  dailyRecurring: [
    {
      id: "5",
      title: "Take Medicine",
      description: null,
      dueDate: new Date(),
    },
  ],
};

export const DailyDigestEmail = ({
  overdue = mockProps.overdue,
  dueToday = mockProps.dueToday,
  dueThisWeek = mockProps.dueThisWeek,
  dailyRecurring = mockProps.dailyRecurring,
}: Partial<DailyDigestEmailProps> = {}) => {
  const hasContent = overdue.length > 0 || dueToday.length > 0 || dueThisWeek.length > 0 || dailyRecurring.length > 0;

  return (
    <Tailwind
      config={{
        theme: {
          extend: {
            colors: {
              // Hex conversions of globals.css oklch values (email clients don't support oklch)
              background: "#E7E5E4",
              card: "#F5F5F4",
              foreground: "#172C3C",
              primary: "#6366F1",
              border: "#D6D3D1",
              muted: "#6B7280",
              destructive: "#EF4443",
              amber: "#F59E0B",
            },
          },
        },
      }}
    >
      <Html lang="en">
        <Head />
        <Preview>
          {overdue.length > 0
            ? `${overdue.length} overdue task${overdue.length !== 1 ? "s" : ""} need your attention`
            : "You're all caught up — here's your daily summary"}
        </Preview>
        <Body className="bg-background font-sans">
          <Container className="mx-auto max-w-[600px] px-6 py-8">
            {/* Header */}
            <Section className="mb-2 text-center">
              <Heading as="h1" className="text-primary m-0 text-3xl font-bold">
                Momentum
              </Heading>
              <Text className="text-muted mt-1 mb-0 text-sm">Daily Digest</Text>
            </Section>

            <Hr className="border-border my-6" />

            {/* Overdue */}
            {overdue.length > 0 && (
              <Section className="mb-6">
                <Heading as="h2" className="text-destructive mt-0 mb-3 text-xs font-semibold tracking-widest uppercase">
                  Overdue ({overdue.length})
                </Heading>
                {overdue.map((task) => (
                  <Section key={task.id} className="border-destructive bg-card mb-2 rounded-lg border px-5 py-4">
                    <Link
                      href={`${process.env.NEXT_PUBLIC_BASE_URL}/task/${task.id}`}
                      className="text-foreground text-sm font-semibold no-underline"
                    >
                      {task.title}
                    </Link>
                    <Text className="text-destructive m-0 mt-1 text-xs">
                      Due{" "}
                      {`${format(task.dueDate!, "MMMM d, yyyy")} (${Math.abs(differenceInCalendarDays(task.dueDate!, new Date()))} days overdue)`}
                    </Text>
                  </Section>
                ))}
              </Section>
            )}

            {/* Due today */}
            {dueToday.length > 0 && (
              <Section className="mb-6">
                <Heading as="h2" className="text-primary mt-0 mb-3 text-xs font-semibold tracking-widest uppercase">
                  Due Today ({dueToday.length})
                </Heading>
                {dueToday.map((task) => (
                  <Section key={task.id} className="border-primary bg-card mb-2 rounded-lg border px-5 py-4">
                    <Link
                      href={`${process.env.NEXT_PUBLIC_BASE_URL}/task/${task.id}`}
                      className="text-foreground text-sm font-semibold no-underline"
                    >
                      {task.title}
                    </Link>
                    {task.description && <Text className="text-muted m-0 mt-1 text-xs">{task.description}</Text>}
                  </Section>
                ))}
              </Section>
            )}

            {/* Daily recurring tasks */}
            {dailyRecurring.length > 0 && (
              <Section className="mb-6">
                <Heading as="h2" className="text-amber mt-0 mb-3 text-xs font-semibold tracking-widest uppercase">
                  Daily Tasks ({dailyRecurring.length})
                </Heading>
                {dailyRecurring.map((task) => (
                  <Section key={task.id} className="border-amber bg-card mb-2 rounded-lg border px-5 py-4">
                    <Link
                      href={`${process.env.NEXT_PUBLIC_BASE_URL}/task/${task.id}`}
                      className="text-foreground text-sm font-semibold no-underline"
                    >
                      {task.title}
                    </Link>
                    {task.description && <Text className="text-muted m-0 mt-1 text-xs">{task.description}</Text>}
                  </Section>
                ))}
              </Section>
            )}

            {/* Due this week — grouped by date */}
            {dueThisWeek.length > 0 && (
              <Section className="mb-6">
                <Heading as="h2" className="text-muted mt-0 mb-3 text-xs font-semibold tracking-widest uppercase">
                  Due This Week
                </Heading>
                {dueThisWeek.map(({ date, tasks }) => (
                  <Section key={date.getTime()} className="mb-4">
                    <Text className="text-muted mt-0 mb-2 text-xs font-semibold">{format(date, "EEEE, MMMM d")}</Text>
                    {tasks.map((task) => (
                      <Section key={task.id} className="border-border bg-card mb-2 rounded-lg border px-5 py-4">
                        <Link
                          href={`${process.env.NEXT_PUBLIC_BASE_URL}/task/${task.id}`}
                          className="text-foreground text-sm font-semibold no-underline"
                        >
                          {task.title}
                        </Link>
                        {task.description && <Text className="text-muted m-0 mt-1 text-xs">{task.description}</Text>}
                      </Section>
                    ))}
                  </Section>
                ))}
              </Section>
            )}

            {/* Empty state */}
            {!hasContent && (
              <Section className="py-10 text-center">
                <Text className="text-muted text-base">Nothing due this week. Great work!</Text>
              </Section>
            )}

            <Hr className="border-border my-6" />

            {/* Footer */}
            <Section className="text-center">
              <Link
                href={`${process.env.NEXT_PUBLIC_BASE_URL}`}
                className="text-primary text-sm font-medium no-underline"
              >
                Momentum
              </Link>
              <Text className="text-muted mt-3 mb-0 text-xs leading-5">
                You&apos;re receiving this because you have an active Momentum account.
                <br />
                To stop these emails, update your notification preferences in account settings (not yet implemented).
              </Text>
            </Section>
          </Container>
        </Body>
      </Html>
    </Tailwind>
  );
};

export default DailyDigestEmail;
