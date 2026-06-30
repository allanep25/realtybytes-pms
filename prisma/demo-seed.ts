import "dotenv/config";

import {
  BookingSource,
  EmployeeRole,
  EmployeeStatus,
  ExpenseCategory,
  HousekeepingStatus,
  PaymentMethod,
  Prisma,
  PrismaClient,
  ReservationStatus,
  RoomStatus,
} from "@prisma/client";
import { hash } from "bcryptjs";
import {
  addHotelDays,
  daysBetween,
  hotelCalendarDate,
  parseHotelCalendarDate,
  setHotelTime,
} from "../src/lib/dates";
import { getRoomCatalogEntry, ROOM_NUMBERS } from "../src/lib/room-rates";
import { buildStayFolioLines, folioLinesTotal } from "../src/lib/stay-pricing";

const prisma = new PrismaClient();
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || "demo1234";

const confirmReset = process.argv.includes("--confirm") || process.env.DEMO_SEED_CONFIRM === "RESET_DEMO";

type DemoEmployee = {
  key: string;
  name: string;
  email: string;
  role: EmployeeRole;
};

const DEMO_EMPLOYEES: DemoEmployee[] = [
  { key: "admin", name: "Demo Administrator", email: "demo.admin@realtybytes.test", role: EmployeeRole.ADMINISTRATOR },
  { key: "frontdesk", name: "Lester Demo", email: "demo.frontdesk@realtybytes.test", role: EmployeeRole.FRONT_DESK },
  { key: "frontdesk2", name: "Mia Demo", email: "demo.frontdesk2@realtybytes.test", role: EmployeeRole.FRONT_DESK },
  { key: "guard", name: "Noel Guard Demo", email: "demo.guard@realtybytes.test", role: EmployeeRole.SECURITY },
  { key: "housekeeping", name: "Ana Housekeeping Demo", email: "demo.housekeeping@realtybytes.test", role: EmployeeRole.HOUSEKEEPING },
];

function roomSeedData(number: string) {
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
}

async function resetDatabase() {
  await prisma.dayCloseRecord.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.shiftNote.deleteMany();
  await prisma.folioPayment.deleteMany();
  await prisma.folioLine.deleteMany();
  await prisma.folio.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.housekeepingTask.deleteMany();
  await prisma.guest.deleteMany();
  await prisma.room.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.hotelSettings.deleteMany();
}

async function seedSettings() {
  await prisma.hotelSettings.create({
    data: {
      id: "default",
      name: "RealtyBytes Demo",
      tagline: "Demo environment only",
      address: "Demo Street, Cagayan de Oro City",
      phone: "0917 000 0000",
      email: "demo@realtybytes.test",
      receiptFooter: "Demo receipt only â€” not an official transaction.",
    },
  });
}

async function seedEmployees() {
  const passwordHash = await hash(DEMO_PASSWORD, 10);
  const employees = new Map<string, { id: string; name: string; role: EmployeeRole }>();

  for (const employee of DEMO_EMPLOYEES) {
    const created = await prisma.employee.create({
      data: {
        name: employee.name,
        email: employee.email,
        passwordHash,
        role: employee.role,
        status: EmployeeStatus.ACTIVE,
      },
      select: { id: true, name: true, role: true },
    });
    employees.set(employee.key, created);
  }

  return employees;
}

async function seedRooms() {
  const rooms = new Map<string, { id: string; number: string; baseRate: unknown }>();

  for (const number of ROOM_NUMBERS) {
    const created = await prisma.room.create({
      data: roomSeedData(number),
      select: { id: true, number: true, baseRate: true },
    });
    await prisma.housekeepingTask.create({
      data: {
        roomId: created.id,
        status: HousekeepingStatus.CLEAN,
      },
    });
    rooms.set(number, created);
  }

  return rooms;
}

function requireMapValue<T>(map: Map<string, T>, key: string): T {
  const value = map.get(key);
  if (!value) throw new Error(`Missing demo seed value for ${key}`);
  return value;
}

function lineTotal(lines: { amount: number }[]) {
  return Math.round(lines.reduce((sum, line) => sum + line.amount, 0) * 100) / 100;
}

async function createGuestReservation(input: {
  guestName: string;
  roomNumber: string;
  checkIn: Date;
  checkOut: Date;
  scheduledArrival?: Date | null;
  scheduledDeparture?: Date | null;
  status: ReservationStatus;
  adults?: number;
  children?: number;
  encodedById: string;
  checkedInById?: string | null;
  checkedOutById?: string | null;
  bookingSource?: BookingSource;
  bookingReference?: string | null;
  roomMap: Map<string, { id: string; number: string; baseRate: unknown }>;
  paid?: number;
  paymentMethod?: PaymentMethod;
  paymentRecordedById?: string;
  discount?: number;
}) {
  const room = requireMapValue(input.roomMap, input.roomNumber);
  const guest = await prisma.guest.create({
    data: {
      fullName: input.guestName,
      contactNumber: "09" + Math.floor(100000000 + Math.random() * 899999999).toString(),
      idType: "Demo ID",
      idNumber: `DEMO-${input.roomNumber}-${Date.now().toString(36).toUpperCase()}`,
      address: "Demo Address",
      notes: "Demo guest data only.",
    },
  });

  const reservation = await prisma.reservation.create({
    data: {
      guestId: guest.id,
      roomId: room.id,
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      scheduledArrival: input.scheduledArrival ?? setHotelTime(input.checkIn, 14, 0),
      scheduledDeparture: input.scheduledDeparture ?? null,
      adults: input.adults ?? 2,
      children: input.children ?? 0,
      status: input.status,
      bookingType: "GUEST",
      bookingSource: input.bookingSource ?? BookingSource.PHONE,
      bookingReference: input.bookingReference,
      encodedById: input.encodedById,
      checkedInById: input.checkedInById ?? null,
      checkedOutById: input.checkedOutById ?? null,
    },
  });

  const nights = Math.max(1, daysBetween(input.checkIn, input.checkOut));
  const lines = buildStayFolioLines({
    roomNumber: room.number,
    nightlyRate: Number(room.baseRate),
    nights,
    extensionDays: 0,
    extensionHours: 0,
  });
  const subtotal = lineTotal(lines);
  const discount = Math.max(0, Math.min(input.discount ?? 0, subtotal));
  const total = Math.max(0, subtotal - discount);
  const paid = Math.max(0, Math.min(input.paid ?? 0, total));
  const paymentMethod = input.paymentMethod ?? PaymentMethod.CASH;

  const folio = await prisma.folio.create({
    data: {
      folioNumber: `DEMO-${room.number}-${reservation.id.slice(-5).toUpperCase()}`,
      reservationId: reservation.id,
      subtotal,
      discount,
      total,
      paid,
      paidAt: paid > 0 ? new Date() : null,
      paymentMethod: paid > 0 ? paymentMethod : null,
      lines: { create: lines },
    },
  });

  if (paid > 0) {
    await prisma.folioPayment.create({
      data: {
        folioId: folio.id,
        amount: paid,
        method: paymentMethod,
        paidAt: new Date(),
        recordedById: input.paymentRecordedById ?? input.encodedById,
      },
    });
  }

  return { reservation, guest, room, folio };
}

async function seedReservations(
  roomMap: Map<string, { id: string; number: string; baseRate: unknown }>,
  employees: Map<string, { id: string; name: string; role: EmployeeRole }>,
) {
  const todayKey = hotelCalendarDate();
  const today = parseHotelCalendarDate(todayKey);
  const yesterday = addHotelDays(today, -1);
  const tomorrow = addHotelDays(today, 1);
  const twoDays = addHotelDays(today, 2);
  const nextWeek = addHotelDays(today, 7);

  const admin = requireMapValue(employees, "admin");
  const frontdesk = requireMapValue(employees, "frontdesk");
  const frontdesk2 = requireMapValue(employees, "frontdesk2");
  const guard = requireMapValue(employees, "guard");

  await createGuestReservation({
    guestName: "Maria Santos Demo",
    roomNumber: "21",
    checkIn: yesterday,
    checkOut: tomorrow,
    status: ReservationStatus.CHECKED_IN,
    scheduledArrival: setHotelTime(yesterday, 15, 30),
    adults: 2,
    encodedById: frontdesk.id,
    checkedInById: frontdesk.id,
    paymentRecordedById: frontdesk.id,
    paid: Number(requireMapValue(roomMap, "21").baseRate) * 2,
    paymentMethod: PaymentMethod.CASH,
    roomMap,
  });

  await createGuestReservation({
    guestName: "Pedro Reyes Demo",
    roomNumber: "22",
    checkIn: yesterday,
    checkOut: tomorrow,
    status: ReservationStatus.CHECKED_IN,
    scheduledArrival: setHotelTime(yesterday, 20, 15),
    adults: 3,
    encodedById: guard.id,
    checkedInById: guard.id,
    paymentRecordedById: guard.id,
    paid: 1000,
    paymentMethod: PaymentMethod.GCASH,
    roomMap,
  });

  await createGuestReservation({
    guestName: "Fretzel Clavido Demo",
    roomNumber: "33",
    checkIn: today,
    checkOut: tomorrow,
    status: ReservationStatus.CHECKED_IN,
    scheduledArrival: setHotelTime(today, 14, 0),
    adults: 3,
    encodedById: frontdesk.id,
    checkedInById: frontdesk.id,
    paymentRecordedById: frontdesk.id,
    paid: Number(requireMapValue(roomMap, "33").baseRate),
    paymentMethod: PaymentMethod.CASH,
    roomMap,
  });

  await createGuestReservation({
    guestName: "Kyla Andrea Demo",
    roomNumber: "27",
    checkIn: today,
    checkOut: tomorrow,
    status: ReservationStatus.CHECKED_IN,
    scheduledArrival: setHotelTime(today, 13, 45),
    encodedById: frontdesk2.id,
    checkedInById: frontdesk2.id,
    paymentRecordedById: frontdesk2.id,
    paid: Number(requireMapValue(roomMap, "27").baseRate),
    paymentMethod: PaymentMethod.CARD,
    roomMap,
  });

  await createGuestReservation({
    guestName: "Anna Marie Demo",
    roomNumber: "25",
    checkIn: yesterday,
    checkOut: today,
    status: ReservationStatus.CHECKED_IN,
    scheduledDeparture: setHotelTime(today, 12, 0),
    encodedById: frontdesk.id,
    checkedInById: frontdesk.id,
    paymentRecordedById: frontdesk.id,
    paid: 1500,
    paymentMethod: PaymentMethod.CASH,
    roomMap,
  });

  await createGuestReservation({
    guestName: "Brandon Garcia Demo",
    roomNumber: "25",
    checkIn: today,
    checkOut: tomorrow,
    status: ReservationStatus.RESERVED,
    scheduledArrival: setHotelTime(today, 14, 0),
    encodedById: frontdesk.id,
    paymentRecordedById: frontdesk.id,
    paid: 1000,
    paymentMethod: PaymentMethod.GCASH,
    bookingSource: BookingSource.ONLINE,
    bookingReference: "DEMO-AGODA-001",
    roomMap,
  });

  await createGuestReservation({
    guestName: "Shemie Demo",
    roomNumber: "24",
    checkIn: today,
    checkOut: tomorrow,
    status: ReservationStatus.RESERVED,
    scheduledArrival: setHotelTime(today, 14, 0),
    encodedById: frontdesk.id,
    paymentRecordedById: frontdesk.id,
    paid: 1000,
    paymentMethod: PaymentMethod.GCASH,
    bookingSource: BookingSource.PHONE,
    roomMap,
  });

  await createGuestReservation({
    guestName: "Rafael Cruz Demo",
    roomNumber: "31",
    checkIn: tomorrow,
    checkOut: twoDays,
    status: ReservationStatus.RESERVED,
    scheduledArrival: setHotelTime(tomorrow, 14, 0),
    encodedById: admin.id,
    paid: 0,
    roomMap,
  });

  await createGuestReservation({
    guestName: "Owner Visit Demo",
    roomNumber: "38",
    checkIn: nextWeek,
    checkOut: addHotelDays(nextWeek, 2),
    status: ReservationStatus.RESERVED,
    scheduledArrival: setHotelTime(nextWeek, 15, 0),
    encodedById: admin.id,
    paid: 0,
    roomMap,
  });

  const checkedOut = await createGuestReservation({
    guestName: "Jessiebel Ocay Demo",
    roomNumber: "26",
    checkIn: yesterday,
    checkOut: today,
    status: ReservationStatus.CHECKED_OUT,
    scheduledDeparture: setHotelTime(today, 10, 30),
    encodedById: frontdesk.id,
    checkedInById: frontdesk.id,
    checkedOutById: frontdesk.id,
    paymentRecordedById: frontdesk.id,
    paid: Number(requireMapValue(roomMap, "26").baseRate),
    paymentMethod: PaymentMethod.CASH,
    roomMap,
  });

  await prisma.room.update({ where: { id: checkedOut.room.id }, data: { status: RoomStatus.DIRTY } });
  await prisma.housekeepingTask.update({
    where: { roomId: checkedOut.room.id },
    data: {
      status: HousekeepingStatus.DIRTY,
      notes: "Checked out â€” needs cleaning",
      checklistState: Prisma.DbNull,
    },
  });
}

async function syncRoomStatuses(roomMap: Map<string, { id: string }>) {
  const occupied = ["21", "22", "25", "27", "33"];
  const reserved = ["24", "31", "38"];

  for (const number of occupied) {
    await prisma.room.update({
      where: { id: requireMapValue(roomMap, number).id },
      data: { status: RoomStatus.OCCUPIED },
    });
  }

  for (const number of reserved) {
    await prisma.room.update({
      where: { id: requireMapValue(roomMap, number).id },
      data: { status: RoomStatus.RESERVED },
    });
  }
}

async function seedOperationalData(employees: Map<string, { id: string }>) {
  const frontdesk = requireMapValue(employees, "frontdesk");
  const housekeeping = requireMapValue(employees, "housekeeping");
  const today = hotelCalendarDate();

  await prisma.expense.createMany({
    data: [
      {
        businessDate: today,
        amount: 450,
        method: PaymentMethod.CASH,
        category: ExpenseCategory.SUPPLIES,
        description: "Demo cleaning supplies",
        vendor: "Demo Grocery",
        recordedById: frontdesk.id,
      },
      {
        businessDate: today,
        amount: 300,
        method: PaymentMethod.CASH,
        category: ExpenseCategory.TRANSPORT,
        description: "Demo guest shuttle fuel",
        vendor: "Demo Fuel Station",
        recordedById: frontdesk.id,
      },
    ],
  });

  await prisma.shiftNote.create({
    data: {
      content: "Demo: VIP arrival tomorrow. Room 26 needs cleaning after checkout.",
      authorId: frontdesk.id,
    },
  });

  const room23 = await prisma.room.findUnique({ where: { number: "23" } });
  if (room23) {
    await prisma.housekeepingTask.update({
      where: { roomId: room23.id },
      data: {
        status: HousekeepingStatus.CLEANING,
        assignedTo: housekeeping.id,
        notes: "Demo: housekeeping in progress",
        checklistState: Prisma.DbNull,
      },
    });
  }
}

async function main() {
  if (!confirmReset) {
    throw new Error(
      "Demo seed resets the connected database. Re-run with `npm run db:demo-seed -- --confirm` only against a demo database.",
    );
  }

  await resetDatabase();
  await seedSettings();
  const employees = await seedEmployees();
  const rooms = await seedRooms();
  await seedReservations(rooms, employees);
  await syncRoomStatuses(rooms);
  await seedOperationalData(employees);

  console.log("Demo database ready.");
  console.log(`Demo password for all accounts: ${DEMO_PASSWORD}`);
  for (const employee of DEMO_EMPLOYEES) {
    console.log(`${employee.role}: ${employee.email}`);
  }
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


