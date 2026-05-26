import { hotelCalendarDate, parseHotelCalendarDate } from "@/lib/dates";

export type CancellationSettlement = {
  policy: "free" | "late";
  roomAmount: number;
  paid: number;
  cancellationFee: number;
  forfeitAmount: number;
  refundAmount: number;
};

export function isHotelCheckInDay(checkIn: Date | string, now: Date = new Date()): boolean {
  const checkInKey =
    typeof checkIn === "string" ? hotelCalendarDate(new Date(checkIn)) : hotelCalendarDate(checkIn);
  return checkInKey === hotelCalendarDate(now);
}

/** True when cancellation is at least 24 hours before check-in day starts (hotel time). */
export function isFreeCancellationWindow(checkIn: Date | string, now: Date = new Date()): boolean {
  const checkInDate =
    typeof checkIn === "string" ? new Date(checkIn) : checkIn;
  const checkInStart = parseHotelCalendarDate(hotelCalendarDate(checkInDate));
  const cutoff = new Date(checkInStart.getTime() - 24 * 60 * 60 * 1000);
  return now.getTime() < cutoff.getTime();
}

export function calculateCancellationSettlement(
  roomAmount: number,
  paid: number,
  checkIn: Date | string,
  now: Date = new Date(),
): CancellationSettlement {
  const normalizedPaid = Math.max(0, paid);
  const normalizedRoom = Math.max(0, roomAmount);

  if (isFreeCancellationWindow(checkIn, now) || normalizedPaid <= 0) {
    return {
      policy: "free",
      roomAmount: normalizedRoom,
      paid: normalizedPaid,
      cancellationFee: 0,
      forfeitAmount: 0,
      refundAmount: normalizedPaid,
    };
  }

  const cancellationFee = Math.round(normalizedRoom * 0.2 * 100) / 100;
  const forfeitAmount = Math.min(normalizedPaid, cancellationFee);
  const refundAmount = Math.max(0, normalizedPaid - forfeitAmount);

  return {
    policy: "late",
    roomAmount: normalizedRoom,
    paid: normalizedPaid,
    cancellationFee,
    forfeitAmount,
    refundAmount,
  };
}
