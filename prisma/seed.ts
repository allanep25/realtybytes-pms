import {
  EmployeeRole,
  EmployeeStatus,
  HousekeepingStatus,
  PrismaClient,
  RoomStatus,
} from "@prisma/client";
import { hash } from "bcryptjs";
import { getRoomCatalogEntry, ROOM_NUMBERS } from "../src/lib/room-rates";

const prisma = new PrismaClient();

const ROOMS = ROOM_NUMBERS.map((number) => {
  const entry = getRoomCatalogEntry(number);
  return {
    number,
    floor: entry.floor,
    type: entry.type,
    description: entry.description,
    maxPax: entry.maxPax,
    status: RoomStatus.VACANT,
    baseRate: entry.regularRate,
    ...(entry.breakfastRate != null ? { breakfastRate: entry.breakfastRate } : {}),
  };
});

async function main() {
  const adminEmail =
    process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase() || "admin@amarresidence.com";
  const adminName = process.env.SEED_ADMIN_NAME?.trim() || "Administrator";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;

  if (!adminPassword || adminPassword.length < 6) {
    throw new Error(
      "Set SEED_ADMIN_PASSWORD (at least 6 characters) in .env before running seed.",
    );
  }

  await prisma.folioLine.deleteMany();
  await prisma.folio.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.housekeepingTask.deleteMany();
  await prisma.guest.deleteMany();
  await prisma.room.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.hotelSettings.deleteMany();

  await prisma.hotelSettings.create({
    data: {
      id: "default",
      name: "Amar Residences",
      tagline: "",
      address: "",
      phone: "",
      email: adminEmail,
      receiptFooter: "Thank you for staying at Amar Residences!",
    },
  });

  const passwordHash = await hash(adminPassword, 10);

  await prisma.employee.create({
    data: {
      name: adminName,
      email: adminEmail,
      passwordHash,
      role: EmployeeRole.ADMINISTRATOR,
      status: EmployeeStatus.ACTIVE,
    },
  });

  for (const room of ROOMS) {
    const created = await prisma.room.create({ data: room });
    await prisma.housekeepingTask.create({
      data: {
        roomId: created.id,
        status: HousekeepingStatus.CLEAN,
      },
    });
  }

  console.log(
    `Bootstrap complete: ${ROOMS.length} vacant rooms, admin ${adminEmail}. Add staff under Employee Accounts.`,
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
