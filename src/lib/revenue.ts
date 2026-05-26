import { PAYMENT_METHOD_OPTIONS, RESERVATION_STATUS_LABELS } from "@/lib/constants";
import { prisma } from "@/lib/db";
import {
  addHotelDays,
  hotelCalendarDate,
  parseHotelCalendarDate,
} from "@/lib/dates";
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
  kind: "payment" | "discount";
  recordedAt: string;
  amount: number;
  guestName: string;
  roomNumber: string;
  folioNumber: string;
  methodLabel: string;
  detail: string;
};

export type RevenueSummary = {
  from: string;
  to: string;
  total: number;
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
};

function sumPayments(rows: { amount: number }[]) {
  return rows.reduce((acc, row) => acc + row.amount, 0);
}

function buildBreakdown(payments: { amount: number; method: string }[]): RevenueBreakdownItem[] {
  const totalsByMethod = new Map<string, number>();
  for (const payment of payments) {
    totalsByMethod.set(
      payment.method,
      (totalsByMethod.get(payment.method) ?? 0) + payment.amount,
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
      reservation: {
        include: {
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
            reservation: {
              include: {
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
  reservationStatus: string;
  checkIn: Date;
  checkOut: Date;
};

function formatDiscountDetail(row: DiscountRow): string {
  const checkIn = hotelCalendarDate(row.checkIn);
  const checkOut = hotelCalendarDate(row.checkOut);
  const statusLabel = RESERVATION_STATUS_LABELS[row.reservationStatus] ?? row.reservationStatus;

  if (row.reservationStatus === "RESERVED") {
    return `Future booking · Check-in ${checkIn} · ${statusLabel}`;
  }
  if (row.reservationStatus === "CHECKED_IN") {
    return `In-house stay · ${checkIn} – ${checkOut}`;
  }
  if (row.reservationStatus === "CHECKED_OUT") {
    return `Completed stay · ${checkIn} – ${checkOut}`;
  }

  return `${statusLabel} · ${checkIn} – ${checkOut} · Room ${row.roomNumber}`;
}

async function getDiscountRowsForPeriod(from: Date, toExclusive: Date): Promise<DiscountRow[]> {
  const folios = await prisma.folio.findMany({
    where: {
      discount: { gt: 0 },
      reservation: { bookingType: BookingType.GUEST },
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

  return folios.map((folio) => ({
    id: folio.id,
    recordedAt: folio.updatedAt,
    amount: Number(folio.discount),
    guestName: folio.reservation.guest.fullName,
    roomNumber: folio.reservation.room.number,
    folioNumber: folio.folioNumber,
    subtotal: Number(folio.subtotal),
    reservationStatus: folio.reservation.status,
    checkIn: folio.reservation.checkIn,
    checkOut: folio.reservation.checkOut,
  }));
}

/** Guest discounts applied on folios updated during the hotel business period. */
async function getDiscountTotalForPeriod(from: Date, toExclusive: Date): Promise<number> {
  const rows = await getDiscountRowsForPeriod(from, toExclusive);
  return rows.reduce((sum, row) => sum + row.amount, 0);
}

export async function getRevenueForPeriod(
  fromStr: string,
  toStr: string,
): Promise<RevenueSummary> {
  const { from, toExclusive } = parsePeriod(fromStr, toStr);
  const [payments, discountRows] = await Promise.all([
    getPaymentRowsForPeriod(from, toExclusive),
    getDiscountRowsForPeriod(from, toExclusive),
  ]);
  const totalDiscount = discountRows.reduce((sum, row) => sum + row.amount, 0);

  let previousPeriodTotal: number | null = null;
  let changePercent: number | null = null;

  if (fromStr === toStr) {
    const previousFrom = addHotelDays(from, -1);
    const previousPayments = await getPaymentRowsForPeriod(previousFrom, from);
    previousPeriodTotal = sumPayments(previousPayments);
    const total = sumPayments(payments);
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
    detail: "Payment received",
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
    detail: `${formatDiscountDetail(row)} · Room charges ${formatPHP(row.subtotal)}`,
  }));

  const transactions = [...paymentEntries, ...discountEntries].sort(
    (a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime(),
  );

  return {
    from: fromStr,
    to: toStr,
    total: sumPayments(payments),
    totalDiscount,
    previousPeriodTotal,
    changePercent,
    breakdown: buildBreakdown(payments),
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
