import { prisma } from "@/lib/db";
import { addDays, daysBetween, startOfDay } from "@/lib/dates";

export type ReportType = "DAILY_SALES" | "OCCUPANCY" | "REVENUE_SUMMARY";

export type ReportSummary = {
  type: ReportType;
  label: string;
  from: string;
  to: string;
  totalRevenue: number;
  totalTransactions: number;
  occupancyRate: number;
  adr: number;
  rows: ReportRow[];
};

export type ReportRow = {
  label: string;
  value: string;
  amount?: number;
};

const REPORT_LABELS: Record<ReportType, string> = {
  DAILY_SALES: "Daily Sales Report",
  OCCUPANCY: "Occupancy Report",
  REVENUE_SUMMARY: "Revenue Summary",
};

function parseRange(fromStr: string, toStr: string) {
  const from = startOfDay(new Date(fromStr));
  const to = startOfDay(new Date(toStr));
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new Error("Invalid date range");
  }
  if (to < from) throw new Error("End date must be on or after start date");
  return { from, to, toExclusive: addDays(to, 1) };
}

async function computeOccupancyAndAdr(from: Date, toExclusive: Date, roomCount: number) {
  const reservations = await prisma.reservation.findMany({
    where: {
      bookingType: "GUEST",
      status: { notIn: ["CANCELLED", "NO_SHOW"] },
      checkIn: { lt: toExclusive },
      checkOut: { gt: from },
    },
    include: {
      room: { select: { baseRate: true } },
      folio: { select: { total: true } },
    },
  });

  const rangeDays = Math.max(1, daysBetween(from, addDays(toExclusive, -1)));
  const availableRoomNights = roomCount * rangeDays;
  let occupiedRoomNights = 0;
  let roomRevenue = 0;

  for (const res of reservations) {
    const stayStart = res.checkIn < from ? from : startOfDay(res.checkIn);
    const stayEnd =
      res.checkOut > toExclusive ? toExclusive : startOfDay(res.checkOut);
    const nights = Math.max(0, daysBetween(stayStart, stayEnd));
    occupiedRoomNights += nights;
    roomRevenue += Number(res.folio?.total ?? 0);
  }

  const occupancyRate =
    availableRoomNights > 0 ? (occupiedRoomNights / availableRoomNights) * 100 : 0;
  const adr = occupiedRoomNights > 0 ? roomRevenue / occupiedRoomNights : 0;

  return { occupancyRate, adr, occupiedRoomNights, roomRevenue };
}

export async function generateReport(
  type: ReportType,
  fromStr: string,
  toStr: string,
): Promise<ReportSummary> {
  const { from, to, toExclusive } = parseRange(fromStr, toStr);

  const roomCount = await prisma.room.count();
  const folios = await prisma.folio.findMany({
    where: {
      paidAt: { gte: from, lt: toExclusive },
      paid: { gt: 0 },
      reservation: { bookingType: "GUEST" },
    },
    include: {
      reservation: {
        include: {
          guest: { select: { fullName: true } },
          room: { select: { number: true } },
        },
      },
    },
    orderBy: { paidAt: "asc" },
  });

  const totalRevenue = folios.reduce((s, f) => s + Number(f.paid), 0);
  const totalTransactions = folios.length;
  const { occupancyRate, adr } = await computeOccupancyAndAdr(from, toExclusive, roomCount);

  const rows: ReportRow[] = folios.map((f) => ({
    label: `${f.folioNumber} — ${f.reservation.guest.fullName} (Rm ${f.reservation.room.number})`,
    value: f.paidAt ? new Date(f.paidAt).toLocaleDateString("en-PH") : "—",
    amount: Number(f.paid),
  }));

  if (type === "OCCUPANCY") {
    return {
      type,
      label: REPORT_LABELS[type],
      from: from.toISOString(),
      to: to.toISOString(),
      totalRevenue,
      totalTransactions,
      occupancyRate,
      adr,
      rows: [
        {
          label: "Rooms in property",
          value: String(roomCount),
        },
        {
          label: "Report period (days)",
          value: String(Math.max(1, daysBetween(from, to))),
        },
        {
          label: "Occupancy rate",
          value: `${occupancyRate.toFixed(2)}%`,
        },
        {
          label: "Average daily rate (ADR)",
          value: `₱${adr.toFixed(2)}`,
        },
      ],
    };
  }

  if (type === "REVENUE_SUMMARY") {
    const byMethod = folios.reduce<Record<string, number>>((acc, f) => {
      const key = f.paymentMethod ?? "UNSPECIFIED";
      acc[key] = (acc[key] ?? 0) + Number(f.paid);
      return acc;
    }, {});

    return {
      type,
      label: REPORT_LABELS[type],
      from: from.toISOString(),
      to: to.toISOString(),
      totalRevenue,
      totalTransactions,
      occupancyRate,
      adr,
      rows: Object.entries(byMethod).map(([method, amount]) => ({
        label: method.replace("_", " "),
        value: "Payment method",
        amount,
      })),
    };
  }

  return {
    type,
    label: REPORT_LABELS[type],
    from: from.toISOString(),
    to: to.toISOString(),
    totalRevenue,
    totalTransactions,
    occupancyRate,
    adr,
    rows,
  };
}

export function defaultReportRange() {
  const to = startOfDay(new Date());
  const from = addDays(to, -7);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}
