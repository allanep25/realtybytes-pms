import { shiftCheckInsFromDate } from "../src/lib/backdate-arrivals";
import { prisma } from "../src/lib/db";

const fromDate = process.argv[2] ?? "2026-05-26";
const dryRun = process.argv.includes("--dry-run");
const roomNumber = process.argv.find((arg) => arg.startsWith("--room="))?.split("=")[1];
const reservationId = process.argv.find((arg) => arg.startsWith("--id="))?.split("=")[1];
const recentOnly = process.argv.includes("--recent");

async function main() {
  const results = await shiftCheckInsFromDate(fromDate, {
    dryRun,
    roomNumber,
    reservationId,
    recentOnly,
  });

  if (results.length === 0) {
    console.log(`No matching reservations found for check-in date ${fromDate}.`);
    return;
  }

  console.log(
    dryRun
      ? `Dry run — would update ${results.length} reservation(s):`
      : `Updated ${results.length} reservation(s):`,
  );

  for (const row of results) {
    console.log(
      `  Room ${row.roomNumber} — ${row.guestName}: ${row.previousCheckIn.slice(0, 10)} → ${row.newCheckIn.slice(0, 10)}, checkout ${row.previousCheckOut.slice(0, 10)} → ${row.newCheckOut.slice(0, 10)}`,
    );
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
