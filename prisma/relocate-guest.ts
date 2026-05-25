import { relocateGuestToRoom } from "../src/lib/room-relocation";
import { prisma } from "../src/lib/db";

const fromRoom = process.argv[2] ?? "23";
const toRoom = process.argv[3] ?? "24";
const dryRun = process.argv.includes("--dry-run");

async function main() {
  const result = await relocateGuestToRoom({
    fromRoomNumber: fromRoom,
    toRoomNumber: toRoom,
    maintenanceNote: `Under maintenance — guest relocated to Room ${toRoom}`,
    dryRun,
  });

  if (dryRun) {
    console.log(
      `Dry run: would move ${result.guestName} from Room ${result.fromRoomNumber} to Room ${result.toRoomNumber} and mark Room ${fromRoom} out of order.`,
    );
  } else {
    console.log(
      `Moved ${result.guestName} from Room ${result.fromRoomNumber} to Room ${result.toRoomNumber}. Room ${fromRoom} is now under maintenance.`,
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
