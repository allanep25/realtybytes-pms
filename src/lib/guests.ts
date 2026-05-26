import { prisma } from "@/lib/db";
import { daysBetween, hotelCalendarDate } from "@/lib/dates";

export type GuestListItem = {
  id: string;
  fullName: string;
  contactNumber: string | null;
  isVip: boolean;
  stayCount: number;
};

export type GuestStayPreview = {
  reservationId: string;
  checkIn: string;
  checkOut: string;
  roomNumber: string;
  nights: number;
  status: string;
};

export type GuestHistoryGroup = {
  id: string;
  fullName: string;
  contactNumber: string | null;
  isVip: boolean;
  firstStayDate: string;
  stays: GuestStayPreview[];
};

export type StayHistoryItem = {
  id: string;
  checkIn: string;
  checkOut: string;
  roomNumber: string;
  nights: number;
  status: string;
};

export type GuestProfile = {
  id: string;
  fullName: string;
  contactNumber: string | null;
  idType: string | null;
  idNumber: string | null;
  address: string | null;
  isVip: boolean;
  notes: string | null;
  stayHistory: StayHistoryItem[];
};

export type UpdateGuestInput = {
  fullName?: string;
  contactNumber?: string | null;
  idType?: string | null;
  idNumber?: string | null;
  address?: string | null;
  isVip?: boolean;
  notes?: string | null;
};

function normalizeGuestKey(fullName: string): string {
  return fullName.trim().replace(/\s+/g, " ").toLowerCase();
}

function mapReservationToStayPreview(reservation: {
  id: string;
  checkIn: Date;
  checkOut: Date;
  status: string;
  room: { number: string };
}): GuestStayPreview {
  return {
    reservationId: reservation.id,
    checkIn: reservation.checkIn.toISOString(),
    checkOut: reservation.checkOut.toISOString(),
    roomNumber: reservation.room.number,
    nights: Math.max(1, daysBetween(reservation.checkIn, reservation.checkOut)),
    status: reservation.status,
  };
}

function buildGuestHistoryGroups(
  guests: Array<{
    id: string;
    fullName: string;
    contactNumber: string | null;
    isVip: boolean;
    reservations: Array<{
      id: string;
      checkIn: Date;
      checkOut: Date;
      status: string;
      room: { number: string };
    }>;
  }>,
): GuestHistoryGroup[] {
  const groups = new Map<
    string,
    GuestHistoryGroup & { reservationOwners: Map<string, string> }
  >();

  for (const guest of guests) {
    if (guest.reservations.length === 0) continue;

    const key = normalizeGuestKey(guest.fullName);
    const stayPreviews = guest.reservations.map(mapReservationToStayPreview);
    const existing = groups.get(key);

    if (!existing) {
      const sortedStays = [...stayPreviews].sort(
        (a, b) => new Date(a.checkIn).getTime() - new Date(b.checkIn).getTime(),
      );
      const reservationOwners = new Map<string, string>();
      for (const reservation of guest.reservations) {
        reservationOwners.set(reservation.id, guest.id);
      }
      groups.set(key, {
        id: guest.id,
        fullName: guest.fullName,
        contactNumber: guest.contactNumber,
        isVip: guest.isVip,
        firstStayDate: hotelCalendarDate(new Date(sortedStays[0].checkIn)),
        stays: sortedStays,
        reservationOwners,
      });
      continue;
    }

    for (const reservation of guest.reservations) {
      existing.reservationOwners.set(reservation.id, guest.id);
    }
    existing.stays.push(...stayPreviews);
    existing.stays.sort(
      (a, b) => new Date(a.checkIn).getTime() - new Date(b.checkIn).getTime(),
    );
    existing.firstStayDate = hotelCalendarDate(new Date(existing.stays[0].checkIn));
    existing.isVip = existing.isVip || guest.isVip;
    if (!existing.contactNumber && guest.contactNumber) {
      existing.contactNumber = guest.contactNumber;
    }
  }

  return Array.from(groups.values())
    .map(({ reservationOwners, stays, ...group }) => ({
      ...group,
      stays,
      id: reservationOwners.get(stays[0]?.reservationId ?? "") ?? group.id,
    }))
    .sort((a, b) => a.firstStayDate.localeCompare(b.firstStayDate));
}

const guestReservationsInclude = {
  reservations: {
    where: { bookingType: "GUEST" as const },
    include: { room: { select: { number: true } } },
    orderBy: { checkIn: "asc" as const },
  },
};

export async function getGuestHistoryGroups(search?: string): Promise<GuestHistoryGroup[]> {
  const q = search?.trim();

  const guests = await prisma.guest.findMany({
    where: {
      fullName: { not: "Maintenance Block" },
      ...(q
        ? {
            OR: [
              { fullName: { contains: q, mode: "insensitive" } },
              { contactNumber: { contains: q, mode: "insensitive" } },
              { idNumber: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: guestReservationsInclude,
  });

  return buildGuestHistoryGroups(guests);
}

export async function getGuests(search?: string): Promise<GuestListItem[]> {
  const groups = await getGuestHistoryGroups(search);
  return groups.map((group) => ({
    id: group.id,
    fullName: group.fullName,
    contactNumber: group.contactNumber,
    isVip: group.isVip,
    stayCount: group.stays.length,
  }));
}

export async function getGuestProfile(id: string): Promise<GuestProfile | null> {
  const guest = await prisma.guest.findUnique({
    where: { id },
    include: guestReservationsInclude,
  });

  if (!guest || guest.fullName === "Maintenance Block") return null;

  const relatedGuests = await prisma.guest.findMany({
    where: {
      fullName: { equals: guest.fullName, mode: "insensitive" },
      NOT: { fullName: "Maintenance Block" },
    },
    include: guestReservationsInclude,
  });

  const mergedStays = relatedGuests
    .flatMap((relatedGuest) => relatedGuest.reservations.map(mapReservationToStayPreview))
    .sort((a, b) => new Date(a.checkIn).getTime() - new Date(b.checkIn).getTime());

  const isVip = relatedGuests.some((relatedGuest) => relatedGuest.isVip);

  return {
    id: guest.id,
    fullName: guest.fullName,
    contactNumber: guest.contactNumber ?? relatedGuests.find((g) => g.contactNumber)?.contactNumber ?? null,
    idType: guest.idType ?? relatedGuests.find((g) => g.idType)?.idType ?? null,
    idNumber: guest.idNumber ?? relatedGuests.find((g) => g.idNumber)?.idNumber ?? null,
    address: guest.address ?? relatedGuests.find((g) => g.address)?.address ?? null,
    isVip,
    notes: guest.notes ?? relatedGuests.find((g) => g.notes)?.notes ?? null,
    stayHistory: mergedStays.map((stay) => ({
      id: stay.reservationId,
      checkIn: stay.checkIn,
      checkOut: stay.checkOut,
      roomNumber: stay.roomNumber,
      nights: stay.nights,
      status: stay.status,
    })),
  };
}

export async function updateGuest(id: string, input: UpdateGuestInput) {
  if (input.fullName !== undefined && !input.fullName.trim()) {
    throw new Error("Name is required");
  }

  const guest = await prisma.guest.update({
    where: { id },
    data: {
      ...(input.fullName != null ? { fullName: input.fullName.trim() } : {}),
      ...(input.contactNumber !== undefined ? { contactNumber: input.contactNumber } : {}),
      ...(input.idType !== undefined ? { idType: input.idType } : {}),
      ...(input.idNumber !== undefined ? { idNumber: input.idNumber } : {}),
      ...(input.address !== undefined ? { address: input.address } : {}),
      ...(input.isVip !== undefined ? { isVip: input.isVip } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
    },
  });

  return guest;
}

export type DeleteGuestResult = {
  deleted: boolean;
  hadStayHistory: boolean;
};

export async function deleteGuest(id: string): Promise<DeleteGuestResult> {
  const guest = await prisma.guest.findUnique({
    where: { id },
    include: {
      reservations: {
        where: { bookingType: "GUEST" },
        include: { folio: true },
      },
    },
  });

  if (!guest) throw new Error("Guest not found");
  if (guest.fullName === "Maintenance Block") {
    throw new Error("Cannot delete system guest");
  }

  const active = guest.reservations.filter(
    (reservation) => reservation.status === "CHECKED_IN" || reservation.status === "RESERVED",
  );
  if (active.length > 0) {
    throw new Error(
      "Cannot delete guest with active or upcoming reservations. Cancel or complete those stays first.",
    );
  }

  const hadStayHistory = guest.reservations.length > 0;

  await prisma.$transaction(async (tx) => {
    for (const reservation of guest.reservations) {
      if (reservation.folio) {
        await tx.folio.delete({ where: { id: reservation.folio.id } });
      }
    }
    await tx.reservation.deleteMany({ where: { guestId: id } });
    await tx.guest.delete({ where: { id } });
  });

  return { deleted: true, hadStayHistory };
}
