import "dotenv/config";
import { prisma } from "@/lib/prisma";

// One-off: give every existing recurring task its cycle fields.
// Aborts without writing if two tasks of the same template share a dueDate,
// because they would collide on @@unique([recurringTemplateId, cycleStart, sessionIndex]).
async function main() {
  const collisions = await prisma.$queryRaw<{ recurringTemplateId: string; dueDate: Date; count: bigint }[]>`
    SELECT "recurringTemplateId", "dueDate", COUNT(*) AS count
    FROM "Task"
    WHERE "recurringTemplateId" IS NOT NULL AND "dueDate" IS NOT NULL
    GROUP BY "recurringTemplateId", "dueDate"
    HAVING COUNT(*) > 1
  `;

  if (collisions.length > 0) {
    console.error(`Found ${collisions.length} (template, dueDate) collisions — resolve before backfilling:`);
    for (const c of collisions) {
      console.error(`  template ${c.recurringTemplateId}  dueDate ${c.dueDate.toISOString()}  rows ${c.count}`);
    }
    process.exitCode = 1;
    return;
  }

  const isDryRun = process.argv.includes("--dry-run");
  const toUpdate = await prisma.task.count({
    where: { recurringTemplateId: { not: null }, dueDate: { not: null }, cycleStart: null },
  });
  console.log(`${toUpdate} recurring tasks need cycle fields.`);
  if (isDryRun) return;

  const updated = await prisma.$executeRaw`
    UPDATE "Task"
    SET "cycleStart" = "dueDate", "sessionIndex" = 1
    WHERE "recurringTemplateId" IS NOT NULL AND "dueDate" IS NOT NULL AND "cycleStart" IS NULL
  `;
  console.log(`Backfilled ${updated} tasks.`);
}

main()
  .catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
