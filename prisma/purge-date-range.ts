import { purgeStaysInDateRange } from "../src/lib/purge-date-range";
import { prisma } from "../src/lib/db";

const fromDate = process.argv[2] ?? "2026-05-25";
const toDate = process.argv[3] ?? "2026-05-26";
const dryRun = process.argv.includes("--dry-run");

async function main() {
  const results = await purgeStaysInDateRange(fromDate, toDate, { dryRun });

  if (results.length === 0) {
    console.log(`No guest stays overlap ${fromDate} through ${toDate}.`);
    return;
  }

  console.log(
    dryRun
      ? `Dry run — would delete ${results.length} reservation(s):`
      : `Deleted ${results.length} reservation(s):`,
  );

  for (const row of results) {
    console.log(
      `  Room ${row.roomNumber} — ${row.guestName} (${row.status}) ${row.checkIn.slice(0, 10)} → ${row.checkOut.slice(0, 10)}${row.folioNumber ? ` · ${row.folioNumber}` : ""}`,
    );
  }

  if (dryRun) {
    console.log("\nRun without --dry-run to apply.");
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
