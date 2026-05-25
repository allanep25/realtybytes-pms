import { RESERVATION_STATUS_LABELS } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { addDays, daysBetween, startOfDay } from "@/lib/dates";
import type { ReservationStatus } from "@prisma/client";

export type ReportType = "DAILY_SALES" | "OCCUPANCY" | "REVENUE_SUMMARY";

export type ReportSummary = {
  type: ReportType;
  label: string;
  from: string;
  to: string;
  totalRevenue: number;
  totalCollected: number;
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

function formatReportDate(date: Date): string {
  return date.toLocaleDateString("en-PH");
}

function formatMoney(amount: number): string {
  return `₱${amount.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function stayNightsInRange(
  checkIn: Date,
  checkOut: Date,
  from: Date,
  toExclusive: Date,
): number {
  const stayStart = checkIn < from ? from : startOfDay(checkIn);
  const stayEnd = checkOut > toExclusive ? toExclusive : startOfDay(checkOut);
  return Math.max(0, daysBetween(stayStart, stayEnd));
}

function estimateStayTotal(
  checkIn: Date,
  checkOut: Date,
  baseRate: number,
  folioTotal: number | null | undefined,
): number {
  if (folioTotal != null && folioTotal > 0) return folioTotal;
  const nights = Math.max(1, daysBetween(checkIn, checkOut));
  return baseRate * nights;
}

async function getGuestStaysInRange(from: Date, toExclusive: Date) {
  return prisma.reservation.findMany({
    where: {
      bookingType: "GUEST",
      status: { notIn: ["CANCELLED", "NO_SHOW"] },
      checkIn: { lt: toExclusive },
      checkOut: { gt: from },
    },
    include: {
      guest: { select: { fullName: true } },
      room: { select: { number: true, baseRate: true } },
      folio: {
        select: {
          folioNumber: true,
          total: true,
          paid: true,
          paidAt: true,
          paymentMethod: true,
        },
      },
    },
    orderBy: [{ checkIn: "asc" }, { room: { number: "asc" } }],
  });
}

async function getCollectedPayments(from: Date, toExclusive: Date) {
  return prisma.folio.findMany({
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
}

function buildStayRows(
  stays: Awaited<ReturnType<typeof getGuestStaysInRange>>,
  from: Date,
  toExclusive: Date,
): ReportRow[] {
  return stays.map((res) => {
    const baseRate = Number(res.room.baseRate);
    const total = estimateStayTotal(
      res.checkIn,
      res.checkOut,
      baseRate,
      res.folio ? Number(res.folio.total) : null,
    );
    const paid = Number(res.folio?.paid ?? 0);
    const balance = Math.max(0, total - paid);
    const statusLabel =
      RESERVATION_STATUS_LABELS[res.status as ReservationStatus] ?? res.status;

    return {
      label: `${res.folio?.folioNumber ?? "Stay"} — ${res.guest.fullName} (Rm ${res.room.number})`,
      value: `${formatReportDate(res.checkIn)} – ${formatReportDate(res.checkOut)} · ${statusLabel} · Paid ${formatMoney(paid)} · Balance ${formatMoney(balance)}`,
      amount: total,
    };
  });
}

async function computeOccupancyAndAdr(from: Date, toExclusive: Date, roomCount: number) {
  const stays = await getGuestStaysInRange(from, toExclusive);

  const rangeDays = Math.max(1, daysBetween(from, addDays(toExclusive, -1)));
  const availableRoomNights = roomCount * rangeDays;
  let occupiedRoomNights = 0;
  let roomRevenue = 0;

  for (const res of stays) {
    const nights = stayNightsInRange(res.checkIn, res.checkOut, from, toExclusive);
    occupiedRoomNights += nights;
    roomRevenue += estimateStayTotal(
      res.checkIn,
      res.checkOut,
      Number(res.room.baseRate),
      res.folio ? Number(res.folio.total) : null,
    );
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
  const [stays, collectedPayments, metrics] = await Promise.all([
    getGuestStaysInRange(from, toExclusive),
    getCollectedPayments(from, toExclusive),
    computeOccupancyAndAdr(from, toExclusive, roomCount),
  ]);

  const totalRevenue = stays.reduce(
    (sum, res) =>
      sum +
      estimateStayTotal(
        res.checkIn,
        res.checkOut,
        Number(res.room.baseRate),
        res.folio ? Number(res.folio.total) : null,
      ),
    0,
  );
  const totalCollected = collectedPayments.reduce((sum, f) => sum + Number(f.paid), 0);
  const totalTransactions = stays.length;
  const { occupancyRate, adr } = metrics;

  const stayRows = buildStayRows(stays, from, toExclusive);

  if (type === "OCCUPANCY") {
    return {
      type,
      label: REPORT_LABELS[type],
      from: from.toISOString(),
      to: to.toISOString(),
      totalRevenue,
      totalCollected,
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
          label: "Guest stays in period",
          value: String(totalTransactions),
        },
        {
          label: "Occupancy rate",
          value: `${occupancyRate.toFixed(2)}%`,
        },
        {
          label: "Average daily rate (ADR)",
          value: formatMoney(adr),
        },
        {
          label: "Room revenue (folio totals)",
          value: formatMoney(totalRevenue),
        },
        {
          label: "Collected in period",
          value: formatMoney(totalCollected),
        },
      ],
    };
  }

  if (type === "REVENUE_SUMMARY") {
    const byMethod = collectedPayments.reduce<Record<string, number>>((acc, f) => {
      const key = f.paymentMethod ?? "UNSPECIFIED";
      acc[key] = (acc[key] ?? 0) + Number(f.paid);
      return acc;
    }, {});

    const outstanding = Math.max(0, totalRevenue - totalCollected);
    const rows: ReportRow[] = Object.entries(byMethod).map(([method, amount]) => ({
      label: method.replace(/_/g, " "),
      value: "Payment collected in period",
      amount,
    }));

    if (outstanding > 0) {
      rows.push({
        label: "Outstanding balance",
        value: "Room charges not yet collected",
        amount: outstanding,
      });
    }

    if (rows.length === 0 && totalRevenue > 0) {
      rows.push({
        label: "Room revenue",
        value: "No payments collected yet in this period",
        amount: totalRevenue,
      });
    }

    return {
      type,
      label: REPORT_LABELS[type],
      from: from.toISOString(),
      to: to.toISOString(),
      totalRevenue,
      totalCollected,
      totalTransactions,
      occupancyRate,
      adr,
      rows,
    };
  }

  return {
    type,
    label: REPORT_LABELS[type],
    from: from.toISOString(),
    to: to.toISOString(),
    totalRevenue,
    totalCollected,
    totalTransactions,
    occupancyRate,
    adr,
    rows: stayRows,
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
