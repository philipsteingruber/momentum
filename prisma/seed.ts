import "dotenv/config";
import { prisma } from "../src/lib/prisma";

async function main() {
  console.log("Seeding database...");

  // Dev user
  const user = await prisma.user.upsert({
    where: { clerkId: "user_dev_placeholder" },
    update: {},
    create: {
      clerkId: "user_dev_placeholder",
      email: "dev@example.com",
      name: "Dev User",
    },
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
      },
      {
        title: "Write API documentation",
        description: "Document all tRPC endpoints with examples and schemas",
        status: "PENDING" as const,
        dueDate: new Date(2026, 2, 25),
        categoryId: work.id,
      },
      {
        title: "Refactor auth middleware",
        description: "Clean up Clerk integration and add role-based access",
        status: "BLOCKED" as const,
        dueDate: null,
        categoryId: work.id,
      },
      {
        title: "Grocery shopping",
        description: null,
        status: "PENDING" as const,
        dueDate: new Date(2026, 2, 12),
        categoryId: personal.id,
      },
      {
        title: "Schedule dentist appointment",
        description: "Annual checkup — call the dentist's office",
        status: "COMPLETED" as const,
        dueDate: new Date(2026, 2, 5),
        categoryId: health.id,
      },
      {
        title: "Morning run routine",
        description: "5km run, three times a week",
        status: "IN_PROGRESS" as const,
        dueDate: null,
        categoryId: health.id,
      },
      {
        title: "Read 'Designing Data-Intensive Applications'",
        description: "Finish chapters 5-9 on replication and partitioning",
        status: "IN_PROGRESS" as const,
        dueDate: new Date(2026, 3, 1),
        categoryId: learning.id,
      },
      {
        title: "Clean up desktop files",
        description: null,
        status: "CANCELLED" as const,
        dueDate: null,
        categoryId: personal.id,
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
        },
      }),
    ),
  );

  // Notes (attached to specific tasks)
  await Promise.all([
    // Notes on "Set up CI/CD pipeline"
    prisma.note.create({
      data: {
        content:
          "Looked into GitHub Actions vs. GitLab CI — sticking with GH Actions since the repo is already on GitHub.",
        taskId: tasks[0].id,
      },
    }),
    prisma.note.create({
      data: {
        content: "Need to figure out secrets management for the DATABASE_URL env var in the pipeline.",
        taskId: tasks[0].id,
      },
    }),
    // Note on "Write API documentation"
    prisma.note.create({
      data: {
        content: "Check if tRPC-panel or trpc-openapi can auto-generate some of this.",
        taskId: tasks[1].id,
      },
    }),
    // Note on "Refactor auth middleware"
    prisma.note.create({
      data: {
        content: "Blocked on Clerk SDK v7 migration — waiting for updated docs on middleware pattern.",
        taskId: tasks[2].id,
      },
    }),
    // Note on "Read DDIA"
    prisma.note.create({
      data: {
        content: "Chapter 5 on replication was excellent — revisit the section on leaderless replication.",
        taskId: tasks[6].id,
      },
    }),
  ]);

  console.log(`Seeded: 1 user, 4 categories, ${tasks.length} tasks, 5 notes`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
