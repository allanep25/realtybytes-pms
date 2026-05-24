import { PrismaClient } from "@prisma/client";
import { execSync } from "node:child_process";

const prisma = new PrismaClient();

async function main() {
  const roomCount = await prisma.room.count();

  if (roomCount === 0) {
    console.log("Database is empty — running seed...");
    execSync("tsx prisma/seed.ts", { stdio: "inherit" });
    console.log("Seed complete.");
  } else {
    console.log(`Database ready (${roomCount} rooms). Skipping seed.`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
