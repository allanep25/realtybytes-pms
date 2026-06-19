import { PAYMENT_METHOD_OPTIONS, RESERVATION_STATUS_LABELS } from "@/lib/constants";
import { prisma } from "@/lib/db";
import {
  addHotelDays,
  hotelCalendarDate,
  parseHotelCalendarDate,
} from "@/lib/dates";
import { getExpenseRowsForPeriod } from "@/lib/expenses";
import { formatPHP } from "@/lib/format";
import { BookingType, type PaymentMethod } from "@prisma/client";

export type RevenueBreakdownItem = {
  method: string;
  label: string;
  amount: number;
};

/** @deprecated Use RevenueLedgerEntry */
export type PaymentTransaction = RevenueLedgerEntry;

export type RevenueLedgerEntry = {
  id: string;
  kind: "payment" | "discount" | "expense";
  recordedAt: string;
  amount: number;
  guestName: string;
  roomNumber: string;
  folioNumber: string;
  methodLabel: string;
  detail: string;
  folioId?: string;
  ownerReceivedAt?: string | null;
  ownerReceivedByName?: string | null;
};

export type RevenueSummary = {
  from: string;
  to: string;
  total: number;
  grossTotal: number;
  expensesTotal: number;
  totalDiscount: number;
  previousPeriodTotal: number | null;
  changePercent: number | null;
  breakdown: RevenueBreakdownItem[];
  transactions: RevenueLedgerEntry[];
};

type PaymentRow = {
  id: string;
  paidAt: Date;
  amount: number;
  method: string;
  guestName: string;
  roomNumber: string;
  folioNumber: string;
  folioId: string;
  reservationStatus: string;
  checkIn: Date;
  checkOut: Date;
  folioTotal: number;
  folioPaid: number;
  folioDiscount: number;
  ownerReceivedAt: Date | null;
  ownerReceivedByName: string | null;
};

function sumPayments(rows: { amount: number }[]) {
  return rows.reduce((acc, row) => acc + row.amount, 0);
}

function buildBreakdown(
  payments: { amount: number; method: string }[],
  expenses: { amount: number; method: string }[] = [],
): RevenueBreakdownItem[] {
  const totalsByMethod = new Map<string, number>();
  for (const payment of payments) {
    totalsByMethod.set(
      payment.method,
      (totalsByMethod.get(payment.method) ?? 0) + payment.amount,
    );
  }
  for (const expense of expenses) {
    totalsByMethod.set(
      expense.method,
      (totalsByMethod.get(expense.method) ?? 0) - expense.amount,
    );
  }

  return PAYMENT_METHOD_OPTIONS.map((option) => ({
    method: option.value,
    label: option.label,
    amount: totalsByMethod.get(option.value) ?? 0,
  }));
}

function methodLabel(method: string) {
  return PAYMENT_METHOD_OPTIONS.find((option) => option.value === method)?.label ?? method;
}

function formatPaymentDetail(row: PaymentRow): string {
  const checkIn = hotelCalendarDate(row.checkIn);
  const checkOut = hotelCalendarDate(row.checkOut);
  const balance = Math.max(0, row.folioTotal - row.folioPaid);

  if (row.reservationStatus === "RESERVED") {
    if (row.folioPaid >= row.folioTotal && row.folioTotal > 0) {
      return `Future booking · Paid in full · Check-in ${checkIn}`;
    }
    if (balance > 0) {
      return `Future booking deposit · Check-in ${checkIn} · Balance ${formatPHP(balance)}`;
    }
    return `Future booking · Check-in ${checkIn}`;
  }
  if (row.reservationStatus === "CHECKED_IN") {
    return `In-house guest payment · ${checkIn} – ${checkOut}`;
  }
  if (row.reservationStatus === "CHECKED_OUT") {
    return `Check-out payment · ${checkIn} – ${checkOut}`;
  }

  return `Payment · ${checkIn} – ${checkOut}`;
}

function parsePeriod(fromStr: string, toStr: string) {
  const from = parseHotelCalendarDate(fromStr);
  const to = parseHotelCalendarDate(toStr);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new Error("Invalid date");
  }
  if (to < from) {
    throw new Error("End date must be on or after start date");
  }
  return { from, toExclusive: addHotelDays(to, 1) };
}

async function getLegacyFolioPayments(from: Date, toExclusive: Date): Promise<PaymentRow[]> {
  const folios = await prisma.folio.findMany({
    where: {
      paid: { gt: 0 },
      payments: { none: {} },
      reservation: { bookingType: BookingType.GUEST },
      OR: [
        { paidAt: { gte: from, lt: toExclusive } },
        {
          paidAt: null,
          updatedAt: { gte: from, lt: toExclusive },
        },
      ],
    },
    include: {
      ownerReceivedBy: { select: { name: true } },
      reservation: {
        select: {
          status: true,
          checkIn: true,
          checkOut: true,
          guest: { select: { fullName: true } },
          room: { select: { number: true } },
        },
      },
    },
  });

  return folios.map((folio) => ({
    id: `legacy-${folio.id}`,
    paidAt: folio.paidAt ?? folio.updatedAt,
    amount: Number(folio.paid),
    method: (folio.paymentMethod ?? "CASH") as PaymentMethod,
    guestName: folio.reservation.guest.fullName,
    roomNumber: folio.reservation.room.number,
    folioNumber: folio.folioNumber,
    folioId: folio.id,
    reservationStatus: folio.reservation.status,
    checkIn: folio.reservation.checkIn,
    checkOut: folio.reservation.checkOut,
    folioTotal: Number(folio.total),
    folioPaid: Number(folio.paid),
    folioDiscount: Number(folio.discount),
    ownerReceivedAt: folio.ownerReceivedAt,
    ownerReceivedByName: folio.ownerReceivedBy?.name ?? null,
  }));
}

async function getPaymentRowsForPeriod(from: Date, toExclusive: Date): Promise<PaymentRow[]> {
  const [folioPayments, legacyPayments] = await Promise.all([
    prisma.folioPayment.findMany({
      where: {
        paidAt: { gte: from, lt: toExclusive },
        folio: { reservation: { bookingType: BookingType.GUEST } },
      },
      include: {
        folio: {
          include: {
            ownerReceivedBy: { select: { name: true } },
            reservation: {
              select: {
                status: true,
                checkIn: true,
                checkOut: true,
                guest: { select: { fullName: true } },
                room: { select: { number: true } },
              },
            },
          },
        },
      },
      orderBy: { paidAt: "desc" },
    }),
    getLegacyFolioPayments(from, toExclusive),
  ]);

  const tracked = folioPayments.map((payment) => ({
    id: payment.id,
    paidAt: payment.paidAt,
    amount: Number(payment.amount),
    method: payment.method,
    guestName: payment.folio.reservation.guest.fullName,
    roomNumber: payment.folio.reservation.room.number,
    folioNumber: payment.folio.folioNumber,
    folioId: payment.folio.id,
    reservationStatus: payment.folio.reservation.status,
    checkIn: payment.folio.reservation.checkIn,
    checkOut: payment.folio.reservation.checkOut,
    folioTotal: Number(payment.folio.total),
    folioPaid: Number(payment.folio.paid),
    folioDiscount: Number(payment.folio.discount),
    ownerReceivedAt: payment.folio.ownerReceivedAt,
    ownerReceivedByName: payment.folio.ownerReceivedBy?.name ?? null,
  }));

  return [...tracked, ...legacyPayments].sort(
    (a, b) => b.paidAt.getTime() - a.paidAt.getTime(),
  );
}

type DiscountRow = {
  id: string;
  recordedAt: Date;
  amount: number;
  guestName: string;
  roomNumber: string;
  folioNumber: string;
  subtotal: number;
  folioTotal: number;
  folioPaid: number;
  reservationStatus: string;
  checkIn: Date;
  checkOut: Date;
  discountReason: string | null;
};

function formatDiscountDetail(row: DiscountRow): string {
  const checkIn = hotelCalendarDate(row.checkIn);
  const checkOut = hotelCalendarDate(row.checkOut);

  if (row.reservationStatus === "RESERVED") {
    if (row.folioPaid >= row.folioTotal && row.folioTotal > 0) {
      return `Future booking · Paid in full · Check-in ${checkIn}`;
    }
    return `Future booking · Check-in ${checkIn} · Collected ${formatPHP(row.folioPaid)}`;
  }
  if (row.reservationStatus === "CHECKED_IN") {
    return `In-house stay · ${checkIn} – ${checkOut} · Collected ${formatPHP(row.folioPaid)}`;
  }
  if (row.reservationStatus === "CHECKED_OUT") {
    return `Completed stay · ${checkIn} – ${checkOut}`;
  }

  const statusLabel = RESERVATION_STATUS_LABELS[row.reservationStatus] ?? row.reservationStatus;
  return `${statusLabel} · ${checkIn} – ${checkOut}`;
}

function discountCountsForRevenue(folio: {
  paid: { toNumber?: () => number } | number | unknown;
  total: { toNumber?: () => number } | number | unknown;
  reservation: { status: string };
}): boolean {
  const paid = Number(folio.paid);
  const total = Number(folio.total);
  const status = folio.reservation.status;

  if (status === "CHECKED_IN" || status === "CHECKED_OUT") {
    return paid > 0;
  }

  // Future bookings: only when prepaid in full — deposits alone do not count.
  if (status === "RESERVED") {
    return total > 0 && paid >= total;
  }

  return false;
}

/** Discounts on in-house/completed stays, or fully prepaid future bookings only. */
async function getDiscountRowsForPeriod(from: Date, toExclusive: Date): Promise<DiscountRow[]> {
  const folios = await prisma.folio.findMany({
    where: {
      discount: { gt: 0 },
      paid: { gt: 0 },
      reservation: {
        bookingType: BookingType.GUEST,
        status: { in: ["CHECKED_IN", "CHECKED_OUT", "RESERVED"] },
      },
      updatedAt: { gte: from, lt: toExclusive },
    },
    include: {
      reservation: {
        select: {
          status: true,
          checkIn: true,
          checkOut: true,
          guest: { select: { fullName: true } },
          room: { select: { number: true } },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return folios.filter(discountCountsForRevenue).map((folio) => ({
    id: folio.id,
    recordedAt: folio.updatedAt,
    amount: Number(folio.discount),
    guestName: folio.reservation.guest.fullName,
    roomNumber: folio.reservation.room.number,
    folioNumber: folio.folioNumber,
    subtotal: Number(folio.subtotal),
    folioTotal: Number(folio.total),
    folioPaid: Number(folio.paid),
    reservationStatus: folio.reservation.status,
    checkIn: folio.reservation.checkIn,
    checkOut: folio.reservation.checkOut,
    discountReason: folio.discountReason,
  }));
}

export async function getRevenueForPeriod(
  fromStr: string,
  toStr: string,
): Promise<RevenueSummary> {
  const { from, toExclusive } = parsePeriod(fromStr, toStr);
  const [payments, discountRows, expenses] = await Promise.all([
    getPaymentRowsForPeriod(from, toExclusive),
    getDiscountRowsForPeriod(from, toExclusive),
    getExpenseRowsForPeriod(fromStr, toStr),
  ]);
  const totalDiscount = discountRows.reduce((sum, row) => sum + row.amount, 0);

  let previousPeriodTotal: number | null = null;
  let changePercent: number | null = null;

  if (fromStr === toStr) {
    const previousFrom = addHotelDays(from, -1);
    const previousDate = hotelCalendarDate(previousFrom);
    const [previousPayments, previousExpenses] = await Promise.all([
      getPaymentRowsForPeriod(previousFrom, from),
      getExpenseRowsForPeriod(previousDate, previousDate),
    ]);
    previousPeriodTotal = sumPayments(previousPayments) - sumPayments(previousExpenses);
    const total = sumPayments(payments) - sumPayments(expenses);
    changePercent =
      previousPeriodTotal > 0
        ? ((total - previousPeriodTotal) / previousPeriodTotal) * 100
        : total > 0
          ? 100
          : null;
  }

  const paymentEntries: RevenueLedgerEntry[] = payments.map((payment) => ({
    id: payment.id,
    kind: "payment",
    recordedAt: payment.paidAt.toISOString(),
    amount: payment.amount,
    guestName: payment.guestName,
    roomNumber: payment.roomNumber,
    folioNumber: payment.folioNumber,
    methodLabel: methodLabel(payment.method),
    detail: formatPaymentDetail(payment),
    folioId: payment.folioId,
    ownerReceivedAt: payment.ownerReceivedAt ? payment.ownerReceivedAt.toISOString() : null,
    ownerReceivedByName: payment.ownerReceivedByName,
  }));

  const discountEntries: RevenueLedgerEntry[] = discountRows.map((row) => ({
    id: `discount-${row.id}`,
    kind: "discount",
    recordedAt: row.recordedAt.toISOString(),
    amount: row.amount,
    guestName: row.guestName,
    roomNumber: row.roomNumber,
    folioNumber: row.folioNumber,
    methodLabel: "Guest discount",
    detail: `${formatDiscountDetail(row)} · Room charges ${formatPHP(row.subtotal)}${
      row.discountReason ? ` · Reason: ${row.discountReason}` : ""
    }`,
  }));

  const expenseEntries: RevenueLedgerEntry[] = expenses.map((expense) => ({
    id: `expense-${expense.id}`,
    kind: "expense",
    recordedAt: expense.spentAt,
    amount: expense.amount,
    guestName: "Expense",
    roomNumber: "—",
    folioNumber: "—",
    methodLabel: methodLabel(expense.method),
    detail:
      expense.categoryLabel +
      " · " +
      expense.description +
      (expense.vendor ? " · " + expense.vendor : "") +
      " · Recorded by " +
      expense.recordedByName,
  }));

  const transactions = [...paymentEntries, ...discountEntries, ...expenseEntries].sort(
    (a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime(),
  );

  return {
    from: fromStr,
    to: toStr,
    total: sumPayments(payments) - sumPayments(expenses),
    grossTotal: sumPayments(payments),
    expensesTotal: sumPayments(expenses),
    totalDiscount,
    previousPeriodTotal,
    changePercent,
    breakdown: buildBreakdown(payments, expenses),
    transactions,
  };
}

export async function backfillMissingFolioPayments(): Promise<number> {
  const folios = await prisma.folio.findMany({
    where: {
      paid: { gt: 0 },
      payments: { none: {} },
      reservation: { bookingType: BookingType.GUEST },
    },
    select: {
      id: true,
      paid: true,
      paymentMethod: true,
      paidAt: true,
      updatedAt: true,
    },
  });

  for (const folio of folios) {
    const paidAt = folio.paidAt ?? folio.updatedAt;
    await prisma.folioPayment.create({
      data: {
        folioId: folio.id,
        amount: folio.paid,
        method: folio.paymentMethod ?? "CASH",
        paidAt,
      },
    });
  }

  return folios.length;
}

export async function getTodayRevenueSummary(): Promise<RevenueSummary> {
  const today = hotelCalendarDate();
  return getRevenueForPeriod(today, today);
}
