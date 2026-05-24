import {
  BookingType,
  EmployeeRole,
  EmployeeStatus,
  HousekeepingStatus,
  PaymentMethod,
  PrismaClient,
  ReservationStatus,
  RoomStatus,
  RoomType,
} from "@prisma/client";
import { hash } from "bcryptjs";
import { getRoomCatalogEntry, ROOM_NUMBERS } from "../src/lib/room-rates";

const prisma = new PrismaClient();
const DEFAULT_PASSWORD = "admin123";

const ROOM_CONFIG: {
  type: RoomType;
  status: RoomStatus;
}[] = [
  { type: RoomType.SUITE, status: RoomStatus.OCCUPIED },
  { type: RoomType.STANDARD, status: RoomStatus.OCCUPIED },
  { type: RoomType.STANDARD, status: RoomStatus.VACANT },
  { type: RoomType.STANDARD, status: RoomStatus.RESERVED },
  { type: RoomType.STANDARD, status: RoomStatus.OCCUPIED },
  { type: RoomType.STANDARD, status: RoomStatus.DIRTY },
  { type: RoomType.DELUXE, status: RoomStatus.OCCUPIED },
  { type: RoomType.STANDARD, status: RoomStatus.OCCUPIED },
];

function buildRooms(
  numbers: readonly string[],
  statuses: RoomStatus[],
): {
  number: string;
  floor: number;
  type: RoomType;
  description: string;
  maxPax: number;
  status: RoomStatus;
  baseRate: number;
  breakfastRate?: number;
}[] {
  return numbers.map((number, i) => {
    const entry = getRoomCatalogEntry(number);
    return {
      number,
      floor: entry.floor,
      type: entry.type,
      description: entry.description,
      maxPax: entry.maxPax,
      status: statuses[i],
      baseRate: entry.regularRate,
      ...(entry.breakfastRate != null ? { breakfastRate: entry.breakfastRate } : {}),
    };
  });
}

const FLOOR2_NUMBERS = ROOM_NUMBERS.filter((n) => Number(n) < 30);
const FLOOR3_NUMBERS = ROOM_NUMBERS.filter((n) => Number(n) >= 30);

const FLOOR3_CONFIG = [
  { type: RoomType.DELUXE, status: RoomStatus.OCCUPIED },
  { type: RoomType.DELUXE, status: RoomStatus.VACANT },
  { type: RoomType.DELUXE, status: RoomStatus.OCCUPIED },
  { type: RoomType.STANDARD, status: RoomStatus.RESERVED },
  { type: RoomType.STANDARD, status: RoomStatus.OCCUPIED },
  { type: RoomType.STANDARD, status: RoomStatus.DIRTY },
  { type: RoomType.DELUXE, status: RoomStatus.OCCUPIED },
  { type: RoomType.STANDARD, status: RoomStatus.VACANT },
];

const ROOMS = [
  ...buildRooms(FLOOR2_NUMBERS, ROOM_CONFIG.map((c) => c.status)),
  ...buildRooms(FLOOR3_NUMBERS, FLOOR3_CONFIG.map((c) => c.status)),
];

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function atTime(day: Date, hours: number, minutes = 0): Date {
  const x = new Date(day);
  x.setHours(hours, minutes, 0, 0);
  return x;
}

async function main() {
  await prisma.folioLine.deleteMany();
  await prisma.folio.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.housekeepingTask.deleteMany();
  await prisma.guest.deleteMany();
  await prisma.room.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.hotelSettings.deleteMany();

  const today = startOfDay(new Date());
  const yesterday = addDays(today, -1);

  await prisma.hotelSettings.create({
    data: {
      id: "default",
      name: "Amar Residence",
      tagline: "HOTEL",
      address: "123 Hospitality Ave, Metro Manila",
      phone: "+63 2 8123 4567",
      email: "frontdesk@amarresidence.com",
      receiptFooter: "Thank you for staying at Amar Residence!",
    },
  });

  const passwordHash = await hash(DEFAULT_PASSWORD, 10);

  const employees = await Promise.all([
    prisma.employee.create({
      data: {
        name: "Admin User",
        email: "admin@amarresidence.com",
        passwordHash,
        role: EmployeeRole.ADMINISTRATOR,
        status: EmployeeStatus.ACTIVE,
      },
    }),
    prisma.employee.create({
      data: {
        name: "Maria Santos",
        email: "frontdesk@amarresidence.com",
        passwordHash,
        role: EmployeeRole.FRONT_DESK,
        status: EmployeeStatus.ACTIVE,
      },
    }),
    prisma.employee.create({
      data: {
        name: "Juan Dela Cruz",
        email: "housekeeping@amarresidence.com",
        passwordHash,
        role: EmployeeRole.HOUSEKEEPING,
        status: EmployeeStatus.ACTIVE,
      },
    }),
    prisma.employee.create({
      data: { name: "Ana Reyes", role: EmployeeRole.HOUSEKEEPING, status: EmployeeStatus.ACTIVE },
    }),
  ]);

  const hkStaff = employees.find((e) => e.name === "Juan Dela Cruz")!;

  for (const room of ROOMS) {
    const created = await prisma.room.create({ data: room });
    const hkStatus =
      room.status === RoomStatus.DIRTY
        ? HousekeepingStatus.DIRTY
        : room.status === RoomStatus.OUT_OF_ORDER
          ? HousekeepingStatus.OUT_OF_ORDER
          : HousekeepingStatus.CLEAN;

    await prisma.housekeepingTask.create({
      data: {
        roomId: created.id,
        status: hkStatus,
        assignedTo: room.status === RoomStatus.DIRTY ? hkStaff.id : null,
        notes: room.status === RoomStatus.DIRTY ? "Needs cleaning" : null,
      },
    });
  }

  const guestJohn = await prisma.guest.create({
    data: {
      fullName: "Reyes, John",
      contactNumber: "+63 917 123 4567",
      idType: "Passport",
      idNumber: "P12345678",
      address: "Makati City, Metro Manila",
      isVip: true,
      notes: "Prefers quiet rooms",
    },
  });

  const guestMaria = await prisma.guest.create({
    data: {
      fullName: "Santos, Maria",
      contactNumber: "+63 918 987 6543",
      idType: "Driver License",
      idNumber: "DL-987654",
      address: "Quezon City",
    },
  });

  const guestPedro = await prisma.guest.create({
    data: {
      fullName: "Garcia, Pedro",
      contactNumber: "+63 919 555 1212",
      address: "Pasig City",
    },
  });

  const guestAna = await prisma.guest.create({
    data: {
      fullName: "Cruz, Ana",
      contactNumber: "+63 920 444 8899",
      address: "Taguig City",
    },
  });

  const maintenanceGuest = await prisma.guest.create({
    data: {
      fullName: "Maintenance Block",
      notes: "System block for room maintenance",
    },
  });

  async function roomNum(n: string) {
    const r = await prisma.room.findUnique({ where: { number: n } });
    if (!r) throw new Error(`Room ${n} not found`);
    return r;
  }

  type ResInput = {
    guestId: string;
    roomNumber: string;
    checkIn: Date;
    checkOut: Date;
    status: ReservationStatus;
    bookingType?: BookingType;
    arrivalHour?: number;
    departureHour?: number;
  };

  async function createReservation(input: ResInput) {
    const room = await roomNum(input.roomNumber);
    return prisma.reservation.create({
      data: {
        guestId: input.guestId,
        roomId: room.id,
        checkIn: input.checkIn,
        checkOut: input.checkOut,
        status: input.status,
        bookingType: input.bookingType ?? BookingType.GUEST,
        scheduledArrival: input.arrivalHour != null ? atTime(input.checkIn, input.arrivalHour) : null,
        scheduledDeparture:
          input.departureHour != null ? atTime(input.checkOut, input.departureHour) : null,
        adults: 2,
      },
    });
  }

  // Calendar window: 7 days starting 3 days ago
  const weekStart = addDays(today, -3);
  const weekEnd = addDays(weekStart, 6);

  const calendarBookings: ResInput[] = [
    {
      guestId: guestJohn.id,
      roomNumber: "21",
      checkIn: weekStart,
      checkOut: addDays(weekStart, 3),
      status: ReservationStatus.CHECKED_IN,
      arrivalHour: 14,
    },
    {
      guestId: guestMaria.id,
      roomNumber: "22",
      checkIn: addDays(weekStart, 1),
      checkOut: addDays(weekStart, 4),
      status: ReservationStatus.CHECKED_IN,
      arrivalHour: 15,
    },
    {
      guestId: guestPedro.id,
      roomNumber: "23",
      checkIn: addDays(weekStart, 2),
      checkOut: addDays(weekStart, 5),
      status: ReservationStatus.RESERVED,
      arrivalHour: 16,
    },
    {
      guestId: guestAna.id,
      roomNumber: "24",
      checkIn: addDays(weekStart, 1),
      checkOut: addDays(weekStart, 3),
      status: ReservationStatus.CHECKED_IN,
    },
    {
      guestId: guestJohn.id,
      roomNumber: "31",
      checkIn: weekStart,
      checkOut: addDays(weekStart, 5),
      status: ReservationStatus.CHECKED_IN,
    },
    {
      guestId: guestMaria.id,
      roomNumber: "34",
      checkIn: addDays(weekStart, 3),
      checkOut: weekEnd,
      status: ReservationStatus.RESERVED,
      arrivalHour: 14,
    },
    {
      guestId: maintenanceGuest.id,
      roomNumber: "26",
      checkIn: addDays(weekStart, 4),
      checkOut: addDays(weekStart, 6),
      status: ReservationStatus.RESERVED,
      bookingType: BookingType.MAINTENANCE,
    },
  ];

  for (const b of calendarBookings) {
    await createReservation(b);
  }

  // Today's arrivals
  await createReservation({
    guestId: guestJohn.id,
    roomNumber: "25",
    checkIn: today,
    checkOut: addDays(today, 2),
    status: ReservationStatus.RESERVED,
    arrivalHour: 14,
  });

  await createReservation({
    guestId: guestMaria.id,
    roomNumber: "33",
    checkIn: today,
    checkOut: addDays(today, 3),
    status: ReservationStatus.RESERVED,
    arrivalHour: 16,
  });

  // Today's departures
  const depPedro = await createReservation({
    guestId: guestPedro.id,
    roomNumber: "25",
    checkIn: addDays(today, -2),
    checkOut: today,
    status: ReservationStatus.CHECKED_IN,
    departureHour: 11,
  });

  await prisma.reservation.update({
    where: { id: depPedro.id },
    data: { status: ReservationStatus.CHECKED_IN },
  });

  await createReservation({
    guestId: guestAna.id,
    roomNumber: "27",
    checkIn: addDays(today, -1),
    checkOut: today,
    status: ReservationStatus.CHECKED_IN,
    departureHour: 12,
  });

  // Revenue: folios paid today and yesterday
  async function createPaidFolio(
    reservationId: string,
    folioNumber: string,
    total: number,
    paidAt: Date,
  ) {
    await prisma.folio.create({
      data: {
        folioNumber,
        reservationId,
        subtotal: total,
        total,
        paid: total,
        paidAt,
        paymentMethod: PaymentMethod.CASH,
        lines: {
          create: [
            {
              description: "Room Charge",
              quantity: 1,
              rate: total * 0.85,
              amount: total * 0.85,
            },
            {
              description: "Breakfast",
              quantity: 1,
              rate: total * 0.15,
              amount: total * 0.15,
            },
          ],
        },
      },
    });
  }

  const paidTodayRes = await createReservation({
    guestId: guestJohn.id,
    roomNumber: "28",
    checkIn: addDays(today, -1),
    checkOut: addDays(today, 1),
    status: ReservationStatus.CHECKED_IN,
  });

  await createPaidFolio(paidTodayRes.id, "F-1001", 12500, atTime(today, 10, 30));
  await createPaidFolio(depPedro.id, "F-1002", 12060, atTime(today, 11, 15));

  const paidYesterdayRes1 = await createReservation({
    guestId: guestMaria.id,
    roomNumber: "32",
    checkIn: addDays(yesterday, -1),
    checkOut: yesterday,
    status: ReservationStatus.CHECKED_OUT,
  });

  const paidYesterdayRes2 = await createReservation({
    guestId: guestAna.id,
    roomNumber: "38",
    checkIn: addDays(yesterday, -2),
    checkOut: yesterday,
    status: ReservationStatus.CHECKED_OUT,
  });

  await createPaidFolio(paidYesterdayRes1.id, "F-0998", 10831, atTime(yesterday, 14, 0));
  await createPaidFolio(paidYesterdayRes2.id, "F-0999", 11000, atTime(yesterday, 16, 30));

  console.log(
    `Seeded Amar Residence (week ${weekStart.toISOString().slice(0, 10)} – ${weekEnd.toISOString().slice(0, 10)}).`,
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
