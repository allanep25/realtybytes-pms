import { PrismaClient } from "@prisma/client";
import { getRoomCatalogEntry, ROOM_NUMBERS } from "../src/lib/room-rates";

const prisma = new PrismaClient();

async function main() {
  for (const number of ROOM_NUMBERS) {
    const entry = getRoomCatalogEntry(number);
    await prisma.room.updateMany({
      where: { number },
      data: {
        type: entry.type,
        description: entry.description,
        maxPax: entry.maxPax,
        baseRate: entry.regularRate,
        breakfastRate: entry.breakfastRate,
      },
    });
  }
  console.log(
    "Updated room catalog:",
    ROOM_NUMBERS.map(
      (n) => `${n}=${getRoomCatalogEntry(n).description} ₱${getRoomCatalogEntry(n).regularRate}`,
    ).join(", "),
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
