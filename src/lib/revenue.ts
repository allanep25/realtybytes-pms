import { PAYMENT_METHOD_OPTIONS } from "@/lib/constants";
import { prisma } from "@/lib/db";
import {
  addHotelDays,
  hotelCalendarDate,
  parseHotelCalendarDate,
} from "@/lib/dates";
import { BookingType, type PaymentMethod } from "@prisma/client";

export type RevenueBreakdownItem = {
  method: string;
  label: string;
  amount: number;
};

export type PaymentTransaction = {
  id: string;
  paidAt: string;
  amount: number;
  method: string;
  methodLabel: string;
  guestName: string;
  roomNumber: string;
  folioNumber: string;
};

export type RevenueSummary = {
  from: string;
  to: string;
  total: number;
  previousPeriodTotal: number | null;
  changePercent: number | null;
  breakdown: RevenueBreakdownItem[];
  transactions: PaymentTransaction[];
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

export async function getRevenueForPeriod(
  fromStr: string,
  toStr: string,
): Promise<RevenueSummary> {
  const { from, toExclusive } = parsePeriod(fromStr, toStr);
  const payments = await getPaymentRowsForPeriod(from, toExclusive);

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

  const transactions: PaymentTransaction[] = payments.map((payment) => ({
    id: payment.id,
    paidAt: payment.paidAt.toISOString(),
    amount: payment.amount,
    method: payment.method,
    methodLabel: methodLabel(payment.method),
    guestName: payment.guestName,
    roomNumber: payment.roomNumber,
    folioNumber: payment.folioNumber,
  }));

  return {
    from: fromStr,
    to: toStr,
    total: sumPayments(payments),
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
