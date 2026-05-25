import { backdateTodayArrivalsToCheckout } from "../src/lib/backdate-arrivals";
import { prisma } from "../src/lib/db";

const dryRun = process.argv.includes("--dry-run");

async function main() {
  const results = await backdateTodayArrivalsToCheckout({ dryRun });

  if (results.length === 0) {
    console.log("No guest reservations with check-in today were found.");
    return;
  }

  console.log(
    dryRun
      ? `Dry run — would update ${results.length} reservation(s):`
      : `Updated ${results.length} reservation(s):`,
  );

  for (const row of results) {
    console.log(
      `  Room ${row.roomNumber} — ${row.guestName}: ${row.previousCheckIn.slice(0, 10)} → ${row.newCheckIn.slice(0, 10)}, checkout ${row.newCheckOut.slice(0, 10)}`,
    );
  }

  if (dryRun) {
    console.log("\nRun without --dry-run to apply changes.");
  } else {
    console.log("\nGuests are now checked in with check-out today.");
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
