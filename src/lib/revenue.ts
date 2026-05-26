import { PAYMENT_METHOD_OPTIONS } from "@/lib/constants";
import { prisma } from "@/lib/db";
import {
  addHotelDays,
  hotelCalendarDate,
  parseHotelCalendarDate,
} from "@/lib/dates";
import { BookingType } from "@prisma/client";

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

function sumPayments(rows: { amount: unknown }[]) {
  return rows.reduce((acc, row) => acc + Number(row.amount), 0);
}

function buildBreakdown(
  payments: { amount: unknown; method: string }[],
): RevenueBreakdownItem[] {
  const totalsByMethod = new Map<string, number>();
  for (const payment of payments) {
    totalsByMethod.set(
      payment.method,
      (totalsByMethod.get(payment.method) ?? 0) + Number(payment.amount),
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

export async function getRevenueForPeriod(
  fromStr: string,
  toStr: string,
): Promise<RevenueSummary> {
  const { from, toExclusive } = parsePeriod(fromStr, toStr);

  const payments = await prisma.folioPayment.findMany({
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
  });

  let previousPeriodTotal: number | null = null;
  let changePercent: number | null = null;

  if (fromStr === toStr) {
    const previousFrom = addHotelDays(from, -1);
    const previousPayments = await prisma.folioPayment.findMany({
      where: {
        paidAt: { gte: previousFrom, lt: from },
        folio: { reservation: { bookingType: BookingType.GUEST } },
      },
      select: { amount: true },
    });
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
    amount: Number(payment.amount),
    method: payment.method,
    methodLabel: methodLabel(payment.method),
    guestName: payment.folio.reservation.guest.fullName,
    roomNumber: payment.folio.reservation.room.number,
    folioNumber: payment.folio.folioNumber,
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

export async function getTodayRevenueSummary(): Promise<RevenueSummary> {
  const today = hotelCalendarDate();
  return getRevenueForPeriod(today, today);
}
