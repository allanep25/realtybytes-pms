import { PAYMENT_METHOD_OPTIONS, RESERVATION_STATUS_LABELS } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { addDays, daysBetween, startOfDay } from "@/lib/dates";
import { getExpenseRowsForPeriod } from "@/lib/expenses";
import { formatStaffTrail, mapStaffAttribution } from "@/lib/staff-attribution";
import type { EmployeeRole, ReservationStatus } from "@prisma/client";

export type ReportType =
  | "DAILY_SALES"
  | "OCCUPANCY"
  | "REVENUE_SUMMARY"
  | "WEEKLY_SUMMARY"
  | "STAFF_TRANSACTIONS"
  | "EXPENSES";

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
  WEEKLY_SUMMARY: "Weekly Owner Summary",
  STAFF_TRANSACTIONS: "Staff Transactions",
  EXPENSES: "Expenses Report",
};

export type ReportStaffOption = {
  id: string;
  name: string;
  role: EmployeeRole;
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
          payments: {
            select: { method: true, amount: true },
            orderBy: { paidAt: "asc" },
          },
        },
      },
      encodedBy: { select: { name: true, role: true } },
      checkedInBy: { select: { name: true, role: true } },
      checkedOutBy: { select: { name: true, role: true } },
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

export async function getReportStaffOptions(): Promise<ReportStaffOption[]> {
  return prisma.employee.findMany({
    where: {
      status: "ACTIVE",
      role: { in: ["FRONT_DESK", "SECURITY", "ADMINISTRATOR"] },
    },
    orderBy: [{ role: "asc" }, { name: "asc" }],
    select: { id: true, name: true, role: true },
  });
}

async function getStaffTransactionPayments(
  from: Date,
  toExclusive: Date,
  staffId?: string | null,
) {
  return prisma.folioPayment.findMany({
    where: {
      paidAt: { gte: from, lt: toExclusive },
      ...(staffId
        ? {
            OR: [
              { recordedById: staffId },
              {
                recordedById: null,
                folio: {
                  reservation: {
                    OR: [
                      { encodedById: staffId },
                      { checkedInById: staffId },
                      { checkedOutById: staffId },
                    ],
                  },
                },
              },
            ],
          }
        : {}),
      folio: { reservation: { bookingType: "GUEST" } },
    },
    include: {
      recordedBy: { select: { name: true, role: true } },
      folio: {
        include: {
          reservation: {
            select: {
              checkIn: true,
              checkOut: true,
              status: true,
              guest: { select: { fullName: true } },
              room: { select: { number: true } },
              encodedBy: { select: { name: true, role: true } },
              checkedInBy: { select: { name: true, role: true } },
              checkedOutBy: { select: { name: true, role: true } },
            },
          },
        },
      },
    },
    orderBy: { paidAt: "desc" },
  });
}

function paymentMethodLabel(method: string): string {
  return PAYMENT_METHOD_OPTIONS.find((option) => option.value === method)?.label ?? method;
}

function buildStaffTransactionRows(
  payments: Awaited<ReturnType<typeof getStaffTransactionPayments>>,
): ReportRow[] {
  return payments.map((payment) => {
    const reservation = payment.folio.reservation;
    const fallbackStaff =
      reservation.checkedOutBy ?? reservation.checkedInBy ?? reservation.encodedBy ?? null;
    const staffLabel = payment.recordedBy
      ? payment.recordedBy.name + " (" + payment.recordedBy.role.replace("_", " ") + ")"
      : fallbackStaff
        ? fallbackStaff.name + " (inferred from reservation)"
        : "Not recorded (older transaction)";
    const statusLabel =
      RESERVATION_STATUS_LABELS[reservation.status as ReservationStatus] ?? reservation.status;

    return {
      label:
        reservation.guest.fullName +
        " — Rm " +
        reservation.room.number +
        " · " +
        payment.folio.folioNumber,
      value:
        formatReportDate(payment.paidAt) +
        " · " +
        paymentMethodLabel(payment.method) +
        " · " +
        statusLabel +
        " · Recorded by " +
        staffLabel,
      amount: Number(payment.amount),
    };
  });
}

function buildStayRows(stays: Awaited<ReturnType<typeof getGuestStaysInRange>>): ReportRow[] {
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
    const staffTrail = formatStaffTrail(
      mapStaffAttribution(res.encodedBy),
      mapStaffAttribution(res.checkedInBy),
      mapStaffAttribution(res.checkedOutBy),
    );
    const paymentMethods = res.folio?.payments
      ?.filter((payment) => Number(payment.amount) > 0)
      .map((payment) => payment.method) ?? [];
    const distinctMethods = [...new Set(paymentMethods)];
    const methodSource =
      distinctMethods.length > 0
        ? distinctMethods
        : res.folio?.paymentMethod
          ? [res.folio.paymentMethod]
          : [];
    const methodLabel =
      paid > 0 && methodSource.length > 0
        ? methodSource.map(paymentMethodLabel).join(", ")
        : null;
    const stayInfo = `${formatReportDate(res.checkIn)} – ${formatReportDate(res.checkOut)} · ${statusLabel} · Paid ${formatMoney(paid)}${methodLabel ? ` (${methodLabel})` : ""} · Balance ${formatMoney(balance)}`;

    return {
      label: `${res.folio?.folioNumber ?? "Stay"} — ${res.guest.fullName} (Rm ${res.room.number})`,
      value: staffTrail ? `${stayInfo} · ${staffTrail}` : stayInfo,
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

function buildExpenseRows(
  expenses: Awaited<ReturnType<typeof getExpenseRowsForPeriod>>,
): ReportRow[] {
  return expenses.map((expense) => {
    const details = [
      expense.businessDate,
      paymentMethodLabel(expense.method),
      ...(expense.vendor ? [expense.vendor] : []),
      `Recorded by ${expense.recordedByName}`,
    ];
    return {
      label: `${expense.categoryLabel} — ${expense.description}`,
      value: details.join(" · "),
      amount: expense.amount,
    };
  });
}

export async function generateReport(
  type: ReportType,
  fromStr: string,
  toStr: string,
  options: { staffId?: string | null } = {},
): Promise<ReportSummary> {
  const { from, to } = parseRange(fromStr, toStr);

  if (type === "EXPENSES") {
    const expenses = await getExpenseRowsForPeriod(fromStr.slice(0, 10), toStr.slice(0, 10));
    const total = expenses.reduce((sum, expense) => sum + expense.amount, 0);

    return {
      type,
      label: REPORT_LABELS[type],
      from: from.toISOString(),
      to: to.toISOString(),
      totalRevenue: total,
      totalCollected: total,
      totalTransactions: expenses.length,
      occupancyRate: 0,
      adr: 0,
      rows: buildExpenseRows(expenses),
    };
  }

  const toExclusive = addDays(to, 1);
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

  const stayRows = buildStayRows(stays);

  if (type === "STAFF_TRANSACTIONS") {
    const payments = await getStaffTransactionPayments(from, toExclusive, options.staffId);
    const rows = buildStaffTransactionRows(payments);
    const collected = payments.reduce((sum, payment) => sum + Number(payment.amount), 0);

    return {
      type,
      label: REPORT_LABELS[type],
      from: from.toISOString(),
      to: to.toISOString(),
      totalRevenue: collected,
      totalCollected: collected,
      totalTransactions: payments.length,
      occupancyRate: 0,
      adr: 0,
      rows,
    };
  }

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
        { label: "Rooms in property", value: String(roomCount) },
        { label: "Report period (days)", value: String(Math.max(1, daysBetween(from, to))) },
        { label: "Guest stays in period", value: String(totalTransactions) },
        { label: "Occupancy rate", value: `${occupancyRate.toFixed(2)}%` },
        { label: "Average daily rate (ADR)", value: formatMoney(adr) },
        { label: "Room revenue (folio totals)", value: formatMoney(totalRevenue) },
        { label: "Collected in period", value: formatMoney(totalCollected) },
      ],
    };
  }

  if (type === "WEEKLY_SUMMARY") {
    const byMethod = collectedPayments.reduce<Record<string, number>>((acc, f) => {
      const key = f.paymentMethod ?? "UNSPECIFIED";
      acc[key] = (acc[key] ?? 0) + Number(f.paid);
      return acc;
    }, {});

    const rows: ReportRow[] = [
      { label: "Occupancy rate", value: `${occupancyRate.toFixed(2)}%` },
      { label: "Average daily rate (ADR)", value: formatMoney(adr) },
      { label: "Guest stays", value: String(totalTransactions) },
      { label: "Room revenue", value: formatMoney(totalRevenue), amount: totalRevenue },
      { label: "Collected", value: formatMoney(totalCollected), amount: totalCollected },
      ...Object.entries(byMethod).map(([method, amount]) => ({
        label: method.replace(/_/g, " "),
        value: "Collected by payment method",
        amount,
      })),
    ];

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
