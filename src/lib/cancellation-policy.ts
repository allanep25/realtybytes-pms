import { hotelCalendarDate, parseHotelCalendarDate, setHotelTime } from "@/lib/dates";

export type CancellationSettlement = {
  policy: "free" | "late" | "arrival_window";
  roomAmount: number;
  feeBaseAmount: number;
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

/** True when the guest's arrival date is still in the future (hotel calendar day). */
export function isHotelFutureArrival(checkIn: Date | string, now: Date = new Date()): boolean {
  const checkInKey =
    typeof checkIn === "string" ? hotelCalendarDate(new Date(checkIn)) : hotelCalendarDate(checkIn);
  return checkInKey > hotelCalendarDate(now);
}

/** True when cancellation is at least 24 hours before check-in day starts (hotel time). */
export function isFreeCancellationWindow(checkIn: Date | string, now: Date = new Date()): boolean {
  const checkInDate =
    typeof checkIn === "string" ? new Date(checkIn) : checkIn;
  const checkInStart = parseHotelCalendarDate(hotelCalendarDate(checkInDate));
  const cutoff = new Date(checkInStart.getTime() - 24 * 60 * 60 * 1000);
  return now.getTime() < cutoff.getTime();
}

function toDate(value: Date | string): Date {
  return typeof value === "string" ? new Date(value) : value;
}

function resolveScheduledArrival(
  checkIn: Date | string,
  scheduledArrival?: Date | string | null,
): Date {
  if (scheduledArrival) return toDate(scheduledArrival);
  return setHotelTime(hotelCalendarDate(toDate(checkIn)), 14, 0);
}

export function isArrivalWindowCancellation(
  checkIn: Date | string,
  scheduledArrival: Date | string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!isHotelCheckInDay(checkIn, now)) return false;

  const arrivalTime = resolveScheduledArrival(checkIn, scheduledArrival);
  const fourHoursBeforeArrival = new Date(arrivalTime.getTime() - 4 * 60 * 60 * 1000);
  return now.getTime() >= fourHoursBeforeArrival.getTime();
}

export function calculateCancellationSettlement(
  roomAmount: number,
  paid: number,
  checkIn: Date | string,
  now: Date = new Date(),
  options: {
    scheduledArrival?: Date | string | null;
    roomRate?: number | null;
  } = {},
): CancellationSettlement {
  const normalizedPaid = Math.max(0, paid);
  const normalizedRoom = Math.max(0, roomAmount);
  const feeBaseAmount = Math.max(0, options.roomRate ?? normalizedRoom);

  if (isFreeCancellationWindow(checkIn, now) || normalizedPaid <= 0) {
    return {
      policy: "free",
      roomAmount: normalizedRoom,
      feeBaseAmount,
      paid: normalizedPaid,
      cancellationFee: 0,
      forfeitAmount: 0,
      refundAmount: normalizedPaid,
    };
  }

  const isArrivalWindow = isArrivalWindowCancellation(checkIn, options.scheduledArrival, now);
  const cancellationFeeRate = isArrivalWindow ? 0.4 : 0.2;
  const cancellationFee = Math.round(feeBaseAmount * cancellationFeeRate * 100) / 100;
  const forfeitAmount = Math.min(normalizedPaid, cancellationFee);
  const refundAmount = Math.max(0, normalizedPaid - forfeitAmount);

  return {
    policy: isArrivalWindow ? "arrival_window" : "late",
    roomAmount: normalizedRoom,
    feeBaseAmount,
    paid: normalizedPaid,
    cancellationFee,
    forfeitAmount,
    refundAmount,
  };
}
