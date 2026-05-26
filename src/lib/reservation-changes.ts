import type { StaffActionContext } from "@/lib/check-in-out";
import { hasRoomConflict } from "@/lib/check-in-out";
import {
  calculateCancellationSettlement,
  isFreeCancellationWindow,
  isHotelCheckInDay,
} from "@/lib/cancellation-policy";
import { prisma } from "@/lib/db";
import { daysBetween, hotelTimeInput, parseHotelCalendarDate, setHotelTime } from "@/lib/dates";
import { syncRoomOperationalStatus } from "@/lib/room-status";
import { buildStayFolioLines, folioLinesTotal } from "@/lib/stay-pricing";

export type CancelReservationInput = {
  reason: string;
};

export type RebookReservationInput = {
  checkIn: string;
  checkOut: string;
  reason: string;
};

export type CancelReservationResult = {
  roomNumber: string;
  policy: "free" | "late";
  refundAmount: number;
  forfeitAmount: number;
};

async function rebuildReservationFolio(reservationId: string) {
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: { room: true, folio: true },
  });
  if (!reservation?.folio) return;

  const nights = Math.max(1, daysBetween(reservation.checkIn, reservation.checkOut));
  const lines = buildStayFolioLines({
    roomNumber: reservation.room.number,
    nightlyRate: Number(reservation.room.baseRate),
    nights,
    extensionDays: reservation.extensionDays,
    extensionHours: reservation.extensionHours,
  });
  const total = folioLinesTotal(lines);
  const discount = Number(reservation.folio.discount);
  const netTotal = Math.max(0, total - discount);
  const paid = Math.min(Number(reservation.folio.paid), netTotal);

  await prisma.$transaction(async (tx) => {
    await tx.folioLine.deleteMany({ where: { folioId: reservation.folio!.id } });
    await tx.folioLine.createMany({
      data: lines.map((line) => ({
        folioId: reservation.folio!.id,
        description: line.description,
        quantity: line.quantity,
        rate: line.rate,
        amount: line.amount,
      })),
    });
    await tx.folio.update({
      where: { id: reservation.folio!.id },
      data: {
        subtotal: total,
        total: netTotal,
        paid,
        paidAt: paid > 0 ? reservation.folio!.paidAt ?? new Date() : null,
      },
    });
  });
}

export async function cancelReservationWithPolicy(
  reservationId: string,
  staff: StaffActionContext,
  input: CancelReservationInput,
): Promise<CancelReservationResult> {
  const reason = input.reason.trim();
  if (!reason) {
    throw new Error("Please provide a reason for cancellation");
  }

  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: { room: true, folio: true },
  });
  if (!reservation) throw new Error("Reservation not found");
  if (reservation.status !== "RESERVED") {
    throw new Error("Only reserved bookings can be cancelled");
  }
  if (reservation.bookingType !== "GUEST") {
    throw new Error("Maintenance blocks must be removed from the calendar");
  }

  const roomAmount = reservation.folio ? Number(reservation.folio.total) : 0;
  const paid = reservation.folio ? Number(reservation.folio.paid) : 0;
  const settlement = calculateCancellationSettlement(roomAmount, paid, reservation.checkIn);

  await prisma.$transaction(async (tx) => {
    if (reservation.folio) {
      if (settlement.policy === "late" && settlement.forfeitAmount > 0) {
        await tx.folioLine.create({
          data: {
            folioId: reservation.folio.id,
            description: "Late cancellation — 20% room charge retained from deposit",
            quantity: 1,
            rate: settlement.forfeitAmount,
            amount: settlement.forfeitAmount,
          },
        });
      }

      await tx.folio.update({
        where: { id: reservation.folio.id },
        data: {
          paid: settlement.forfeitAmount,
          paidAt: settlement.forfeitAmount > 0 ? reservation.folio.paidAt ?? new Date() : null,
        },
      });
    }

    await tx.reservation.update({
      where: { id: reservationId },
      data: {
        status: "CANCELLED",
        cancellationReason: reason,
        cancelledAt: new Date(),
        encodedById: staff.employeeId,
      },
    });
  });

  await syncRoomOperationalStatus(reservation.roomId);

  return {
    roomNumber: reservation.room.number,
    policy: settlement.policy,
    refundAmount: settlement.refundAmount,
    forfeitAmount: settlement.forfeitAmount,
  };
}

export async function rebookReservation(
  reservationId: string,
  staff: StaffActionContext,
  input: RebookReservationInput,
): Promise<{ roomNumber: string; checkIn: string; checkOut: string }> {
  const reason = input.reason.trim();
  if (!reason) {
    throw new Error("Please provide a reason for rebooking");
  }

  const checkIn = parseHotelCalendarDate(input.checkIn);
  const checkOut = parseHotelCalendarDate(input.checkOut);
  if (checkOut <= checkIn) {
    throw new Error("Check-out must be after check-in");
  }

  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: { room: true, folio: true },
  });
  if (!reservation) throw new Error("Reservation not found");
  if (reservation.status !== "RESERVED") {
    throw new Error("Only reserved bookings can be rebooked");
  }
  if (reservation.bookingType !== "GUEST") {
    throw new Error("Only guest reservations can be rebooked");
  }
  if (isHotelCheckInDay(reservation.checkIn)) {
    throw new Error("Use check-in on arrival day instead of rebooking");
  }

  if (await hasRoomConflict(reservation.roomId, checkIn, checkOut, reservationId)) {
    throw new Error("Room is not available for the selected dates");
  }

  const previousTime = hotelTimeInput(reservation.scheduledArrival) ?? "14:00";
  const [hours, minutes] = previousTime.split(":").map(Number);
  const scheduledArrival = setHotelTime(checkIn, hours || 14, minutes || 0);

  await prisma.reservation.update({
    where: { id: reservationId },
    data: {
      checkIn,
      checkOut,
      scheduledArrival,
      rebookReason: reason,
      encodedById: staff.employeeId,
    },
  });

  if (reservation.folio) {
    await rebuildReservationFolio(reservationId);
  }

  await syncRoomOperationalStatus(reservation.roomId);

  return {
    roomNumber: reservation.room.number,
    checkIn: input.checkIn,
    checkOut: input.checkOut,
  };
}

export { isFreeCancellationWindow, isHotelCheckInDay };
