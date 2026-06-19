import { PAYMENT_METHOD_OPTIONS, RESERVATION_STATUS_LABELS } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { addDays, daysBetween, startOfDay } from "@/lib/dates";
import { getExpenseRowsForPeriod } from "@/lib/expenses";
import { normalizePaymentMethod } from "@/lib/payment-method";
import { formatStaffTrail, mapStaffAttribution } from "@/lib/staff-attribution";
import type { EmployeeRole, PaymentMethod, ReservationStatus } from "@prisma/client";

export type ReportType =
  | "DAILY_SALES"
  | "OCCUPANCY"
  | "REVENUE_SUMMARY"
  | "WEEKLY_SUMMARY"
  | "STAFF_TRANSACTIONS"
  | "EXPENSES"
  | "FINANCIAL";

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
  totalExpenses?: number;
  netIncome?: number;
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
  FINANCIAL: "Financial Statement",
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

async function getRevenueByMethod(from: Date, toExclusive: Date) {
  const payments = await prisma.folioPayment.findMany({
    where: {
      paidAt: { gte: from, lt: toExclusive },
      amount: { gt: 0 },
      folio: { reservation: { bookingType: "GUEST" } },
    },
    select: { method: true, amount: true },
  });
  const byMethod = new Map<string, number>();
  for (const payment of payments) {
    byMethod.set(payment.method, (byMethod.get(payment.method) ?? 0) + Number(payment.amount));
  }
  return { byMethod, count: payments.length };
}

/**
 * Point-in-time balance sheet figures derived from folios as of the `to` date:
 * Accounts Receivable (unpaid guest balances) and Deposits / Unearned revenue
 * (payments held for stays that have not yet checked out).
 */
async function getBalanceSheetSnapshot(toExclusive: Date) {
  // For a current snapshot we can trust folio.paid as the paid-to-date figure
  // for legacy folios that have no per-payment records. For a historical `to`
  // date, folio.paid (all-time) would wrongly count later payments as already
  // collected, so we only use recorded payments dated on/before the snapshot.
  const isCurrentSnapshot = toExclusive > new Date();
  const folios = await prisma.folio.findMany({
    where: {
      reservation: {
        bookingType: "GUEST",
        status: { notIn: ["CANCELLED", "NO_SHOW"] },
        checkIn: { lt: toExclusive },
      },
    },
    select: {
      total: true,
      paid: true,
      reservation: { select: { checkOut: true } },
      payments: {
        where: { paidAt: { lt: toExclusive } },
        select: { amount: true },
      },
    },
  });

  let receivable = 0;
  let unearned = 0;
  for (const folio of folios) {
    const recordedPaid = folio.payments.reduce((sum, p) => sum + Number(p.amount), 0);
    const paidAsOf =
      folio.payments.length > 0
        ? recordedPaid
        : isCurrentSnapshot
          ? Number(folio.paid)
          : 0;
    const total = Number(folio.total);
    const balance = total - paidAsOf;
    if (balance > 0) receivable += balance;
    const completed = folio.reservation
      ? folio.reservation.checkOut < toExclusive
      : true;
    if (!completed && paidAsOf > 0) {
      unearned += total > 0 ? Math.min(paidAsOf, total) : paidAsOf;
    }
  }
  return { receivable, unearned };
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
  method?: PaymentMethod | null,
) {
  return prisma.folioPayment.findMany({
    where: {
      paidAt: { gte: from, lt: toExclusive },
      ...(method ? { method } : {}),
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

type StayWithFolio = Awaited<ReturnType<typeof getGuestStaysInRange>>[number];

function stayPaymentsWithAmount(res: StayWithFolio) {
  return res.folio?.payments?.filter((payment) => Number(payment.amount) > 0) ?? [];
}

function stayMatchesPaymentMethod(res: StayWithFolio, method: PaymentMethod): boolean {
  const payments = stayPaymentsWithAmount(res);
  if (payments.length > 0) return payments.some((payment) => payment.method === method);
  return Number(res.folio?.paid ?? 0) > 0 && res.folio?.paymentMethod === method;
}

function stayCollectedForMethod(res: StayWithFolio, method: PaymentMethod): number {
  const payments = stayPaymentsWithAmount(res);
  if (payments.length > 0) {
    return payments
      .filter((payment) => payment.method === method)
      .reduce((sum, payment) => sum + Number(payment.amount), 0);
  }
  return Number(res.folio?.paid ?? 0) > 0 && res.folio?.paymentMethod === method
    ? Number(res.folio?.paid ?? 0)
    : 0;
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
    const positivePayments =
      res.folio?.payments?.filter((payment) => Number(payment.amount) > 0) ?? [];
    const amountByMethod = new Map<string, number>();
    for (const payment of positivePayments) {
      amountByMethod.set(
        payment.method,
        (amountByMethod.get(payment.method) ?? 0) + Number(payment.amount),
      );
    }
    let methodLabel: string | null = null;
    if (paid > 0) {
      if (amountByMethod.size > 1) {
        methodLabel = [...amountByMethod.entries()]
          .map(([method, amount]) => `${paymentMethodLabel(method)} ${formatMoney(amount)}`)
          .join(", ");
      } else if (amountByMethod.size === 1) {
        methodLabel = paymentMethodLabel([...amountByMethod.keys()][0]);
      } else if (res.folio?.paymentMethod) {
        methodLabel = paymentMethodLabel(res.folio.paymentMethod);
      }
    }
    const stayInfo = `${formatReportDate(res.checkIn)} – ${formatReportDate(res.checkOut)} · ${statusLabel} · Paid ${formatMoney(paid)}${methodLabel ? ` (${methodLabel})` : ""} · Balance ${formatMoney(balance)}`;

    return {
      label: `${res.folio?.folioNumber ?? "Stay"} — ${res.guest.fullName} (Rm ${res.room.number})`,
      value: staffTrail ? `${stayInfo} · ${staffTrail}` : stayInfo,
      amount: total,
    };
  });
}

function occupancyAndAdrFromStays(
  stays: Awaited<ReturnType<typeof getGuestStaysInRange>>,
  from: Date,
  toExclusive: Date,
  roomCount: number,
) {
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

async function computeOccupancyAndAdr(from: Date, toExclusive: Date, roomCount: number) {
  const stays = await getGuestStaysInRange(from, toExclusive);
  return occupancyAndAdrFromStays(stays, from, toExclusive, roomCount);
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
  options: { staffId?: string | null; paymentMethod?: string | null } = {},
): Promise<ReportSummary> {
  const { from, to } = parseRange(fromStr, toStr);
  const paymentFilter = normalizePaymentMethod(options.paymentMethod);

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

  if (type === "FINANCIAL") {
    const toExclusiveFin = addDays(to, 1);
    const [{ byMethod: revenueByMethod, count: paymentCount }, expenses, snapshot] =
      await Promise.all([
        getRevenueByMethod(from, toExclusiveFin),
        getExpenseRowsForPeriod(fromStr.slice(0, 10), toStr.slice(0, 10)),
        getBalanceSheetSnapshot(toExclusiveFin),
      ]);

    const totalRevenue = [...revenueByMethod.values()].reduce((sum, a) => sum + a, 0);
    const expenseByCategory = new Map<string, { label: string; amount: number }>();
    for (const expense of expenses) {
      const current = expenseByCategory.get(expense.category) ?? {
        label: expense.categoryLabel,
        amount: 0,
      };
      current.amount += expense.amount;
      expenseByCategory.set(expense.category, current);
    }
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
    const netIncome = totalRevenue - totalExpenses;

    const rows: ReportRow[] = [];
    rows.push({
      label: "INCOME STATEMENT",
      value: `${formatReportDate(from)} – ${formatReportDate(to)}`,
    });
    rows.push({ label: "Revenue (payments collected)", value: "Cash received in period" });
    if (revenueByMethod.size === 0) {
      rows.push({ label: "  No payments collected", value: "", amount: 0 });
    } else {
      for (const [method, amount] of revenueByMethod) {
        rows.push({ label: `  ${paymentMethodLabel(method)}`, value: "Collected", amount });
      }
    }
    rows.push({ label: "Total Revenue", value: "", amount: totalRevenue });
    rows.push({ label: "Less: Operating Expenses", value: "By category" });
    if (expenseByCategory.size === 0) {
      rows.push({ label: "  No expenses recorded", value: "", amount: 0 });
    } else {
      for (const { label, amount } of expenseByCategory.values()) {
        rows.push({ label: `  ${label}`, value: "Expense", amount });
      }
    }
    rows.push({ label: "Total Expenses", value: "", amount: totalExpenses });
    rows.push({
      label: "NET INCOME",
      value: netIncome >= 0 ? "Profit for the period" : "Loss for the period",
      amount: netIncome,
    });

    rows.push({ label: "BALANCE SHEET SNAPSHOT", value: `As of ${formatReportDate(to)}` });
    rows.push({
      label: "Accounts Receivable",
      value: "Unpaid guest balances (money owed to you)",
      amount: snapshot.receivable,
    });
    rows.push({
      label: "Deposits / Unearned Revenue",
      value: "Payments held for stays not yet checked out",
      amount: snapshot.unearned,
    });
    rows.push({
      label: "Net Income (this period)",
      value: "From income statement above",
      amount: netIncome,
    });

    return {
      type,
      label: REPORT_LABELS[type],
      from: from.toISOString(),
      to: to.toISOString(),
      totalRevenue,
      totalCollected: totalRevenue,
      totalTransactions: paymentCount,
      occupancyRate: 0,
      adr: 0,
      totalExpenses,
      netIncome,
      rows,
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
    const payments = await getStaffTransactionPayments(
      from,
      toExclusive,
      options.staffId,
      paymentFilter,
    );
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

  const displayStays = paymentFilter
    ? stays.filter((res) => stayMatchesPaymentMethod(res, paymentFilter))
    : stays;
  const displayRows = paymentFilter ? buildStayRows(displayStays) : stayRows;
  const displayRevenue = paymentFilter
    ? displayStays.reduce(
        (sum, res) =>
          sum +
          estimateStayTotal(
            res.checkIn,
            res.checkOut,
            Number(res.room.baseRate),
            res.folio ? Number(res.folio.total) : null,
          ),
        0,
      )
    : totalRevenue;
  const displayCollected = paymentFilter
    ? displayStays.reduce((sum, res) => sum + stayCollectedForMethod(res, paymentFilter), 0)
    : totalCollected;
  const displayMetrics = paymentFilter
    ? occupancyAndAdrFromStays(displayStays, from, toExclusive, roomCount)
    : { occupancyRate, adr };

  return {
    type,
    label: REPORT_LABELS[type],
    from: from.toISOString(),
    to: to.toISOString(),
    totalRevenue: displayRevenue,
    totalCollected: displayCollected,
    totalTransactions: displayStays.length,
    occupancyRate: displayMetrics.occupancyRate,
    adr: displayMetrics.adr,
    rows: displayRows,
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
