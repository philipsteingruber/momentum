import "dotenv/config";
import { prisma } from "../src/lib/prisma";

async function main() {
  console.log("Seeding database...");

  // Dev user
  const user = await prisma.user.upsert({
    where: { clerkId: "user_3Aoj02OZAvvPOGgouCNxqTCNKCQ" },
    update: {},
    create: {
      clerkId: "user_3Aoj02OZAvvPOGgouCNxqTCNKCQ",
      email: "philip.steingruber@gmail.com",
      name: "Philip Steingrüber",
      userSettings: { create: {} },
    },
  });

  await prisma.userSettings.upsert({
    where: { userId: user.id },
    update: {},
    create: { userId: user.id },
  });

  // Categories
  const [work, personal, health, learning] = await Promise.all(
    [
      { name: "Work", color: "#3b82f6" },
      { name: "Personal", color: "#a855f7" },
      { name: "Health", color: "#22c55e" },
      { name: "Learning", color: "#f59e0b" },
    ].map((cat) =>
      prisma.category.upsert({
        where: { userId_name: { userId: user.id, name: cat.name } },
        update: {},
        create: { ...cat, userId: user.id },
      }),
    ),
  );

  // Tasks
  const tasks = await Promise.all(
    [
      {
        title: "Set up CI/CD pipeline",
        description:
          "Configure GitHub Actions for automated testing and deployment. Configure GitHub Actions for automated testing and deployment. Configure GitHub Actions for automated testing and deployment. Configure GitHub Actions for automated testing and deployment.",
        status: "IN_PROGRESS" as const,
        dueDate: new Date(2026, 2, 18),
        categoryId: work.id,
        link: "https://docs.github.com/en/actions",
        externalContact: "DevOps team",
      },
      {
        title: "Write API documentation",
        description: "Document all tRPC endpoints with examples and schemas",
        status: "PENDING" as const,
        dueDate: new Date(2026, 2, 25),
        categoryId: work.id,
        link: "https://trpc.io/docs",
        externalContact: null,
      },
      {
        title: "Refactor auth middleware",
        description: "Clean up Clerk integration and add role-based access",
        status: "BLOCKED" as const,
        dueDate: null,
        categoryId: work.id,
        link: "https://clerk.com/docs/references/nextjs/clerk-middleware",
        externalContact: "Clerk support",
      },
      {
        title: "Grocery shopping",
        description: null,
        status: "PENDING" as const,
        dueDate: new Date(2026, 2, 12),
        categoryId: personal.id,
        link: null,
        externalContact: null,
      },
      {
        title: "Schedule dentist appointment",
        description: "Annual checkup — call Dr. Müller's office",
        status: "COMPLETED" as const,
        dueDate: new Date(2026, 2, 5),
        categoryId: health.id,
        link: null,
        externalContact: "Dr. Müller's office",
      },
      {
        title: "Morning run routine",
        description: "5km run, three times a week",
        status: "IN_PROGRESS" as const,
        dueDate: null,
        categoryId: health.id,
        link: null,
        externalContact: null,
      },
      {
        title: "Read 'Designing Data-Intensive Applications'",
        description: "Finish chapters 5-9 on replication and partitioning",
        status: "IN_PROGRESS" as const,
        dueDate: new Date(2026, 3, 1),
        categoryId: learning.id,
        link: "https://www.oreilly.com/library/view/designing-data-intensive-applications/9781491903063/",
        externalContact: null,
      },
      {
        title: "Clean up desktop files",
        description: null,
        status: "CANCELLED" as const,
        dueDate: null,
        categoryId: personal.id,
        link: null,
        externalContact: null,
      },
    ].map((task) =>
      prisma.task.create({
        data: {
          title: task.title,
          description: task.description,
          status: task.status,
          dueDate: task.dueDate,
          userId: user.id,
          categoryId: task.categoryId,
          link: task.link,
          externalContact: task.externalContact,
        },
      }),
    ),
  );

  // Wire up blocked task: "Refactor auth middleware" is blocked by "Set up CI/CD pipeline"
  await prisma.task.update({
    where: { id: tasks[2].id },
    data: { blockedById: tasks[0].id },
  });

  // Notes (attached to specific tasks)
  // Distribution: CI/CD=5, API docs=3, Auth=2, Grocery=0, Dentist=1, Run=4, DDIA=5, Desktop=0
  await Promise.all([
    // "Set up CI/CD pipeline" — 5 notes
    prisma.note.create({
      data: {
        content: "Looked into GitHub Actions vs. GitLab CI — sticking with GH Actions since the repo is already on GitHub.",
        taskId: tasks[0].id,
      },
    }),
    prisma.note.create({
      data: {
        content: "Need to figure out secrets management for the DATABASE_URL env var in the pipeline.",
        taskId: tasks[0].id,
      },
    }),
    prisma.note.create({
      data: {
        content: "Added a caching step for pnpm node_modules — cut build time from ~2min to ~40s.",
        taskId: tasks[0].id,
      },
    }),
    prisma.note.create({
      data: {
        content: "Deploy step should only run on pushes to main, not on PRs — update the workflow trigger.",
        taskId: tasks[0].id,
      },
    }),
    prisma.note.create({
      data: {
        content: "Consider adding a Lighthouse CI step to catch performance regressions automatically.",
        taskId: tasks[0].id,
      },
    }),

    // "Write API documentation" — 3 notes
    prisma.note.create({
      data: {
        content: "Check if tRPC-panel or trpc-openapi can auto-generate some of this.",
        taskId: tasks[1].id,
      },
    }),
    prisma.note.create({
      data: {
        content: "Priority endpoints to document first: task CRUD, category management, and auth flows.",
        taskId: tasks[1].id,
      },
    }),
    prisma.note.create({
      data: {
        content: "Add request/response examples directly in the tRPC router files as JSDoc comments.",
        taskId: tasks[1].id,
      },
    }),

    // "Refactor auth middleware" — 2 notes
    prisma.note.create({
      data: {
        content: "Blocked on Clerk SDK v7 migration — waiting for updated docs on middleware pattern.",
        taskId: tasks[2].id,
      },
    }),
    prisma.note.create({
      data: {
        content: "Role-based access will need a custom claim in the Clerk JWT — look into `publicMetadata`.",
        taskId: tasks[2].id,
      },
    }),

    // "Grocery shopping" — 0 notes (intentionally omitted)

    // "Schedule dentist appointment" — 1 note
    prisma.note.create({
      data: {
        content: "Called Dr. Müller's office — appointment confirmed for March 5th at 10:00.",
        taskId: tasks[4].id,
      },
    }),

    // "Morning run routine" — 4 notes
    prisma.note.create({
      data: {
        content: "Current pace is around 5:45/km — aiming to get it under 5:30 by end of April.",
        taskId: tasks[5].id,
      },
    }),
    prisma.note.create({
      data: {
        content: "Tuesday and Thursday mornings work best — Friday is hit or miss depending on work schedule.",
        taskId: tasks[5].id,
      },
    }),
    prisma.note.create({
      data: {
        content: "Left knee felt tight after last run — look into better warm-up stretches.",
        taskId: tasks[5].id,
      },
    }),
    prisma.note.create({
      data: {
        content: "Tried a new route through the park — adds an extra 800m but much more pleasant.",
        taskId: tasks[5].id,
      },
    }),

    // "Read DDIA" — 5 notes
    prisma.note.create({
      data: {
        content: "Chapter 5 on replication was excellent — revisit the section on leaderless replication.",
        taskId: tasks[6].id,
      },
    }),
    prisma.note.create({
      data: {
        content: "Chapter 6 covers partitioning strategies — good mental model for how Postgres sharding works.",
        taskId: tasks[6].id,
      },
    }),
    prisma.note.create({
      data: {
        content: "Make a summary note of the consistency models (linearizability vs. eventual) before moving to ch. 9.",
        taskId: tasks[6].id,
      },
    }),
    prisma.note.create({
      data: {
        content: "The two-phase commit explanation in ch. 9 finally made XA transactions click.",
        taskId: tasks[6].id,
      },
    }),
    prisma.note.create({
      data: {
        content: "Cross-reference the batch processing chapter with the Kafka docs — a lot of overlap.",
        taskId: tasks[6].id,
      },
    }),

    // "Clean up desktop files" — 0 notes (intentionally omitted)
  ]);

  console.log(`Seeded: 1 user, 4 categories, ${tasks.length} tasks, 20 notes`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
