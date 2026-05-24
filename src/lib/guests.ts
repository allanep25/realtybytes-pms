import { prisma } from "@/lib/db";
import { daysBetween } from "@/lib/dates";

export type GuestListItem = {
  id: string;
  fullName: string;
  contactNumber: string | null;
  isVip: boolean;
  stayCount: number;
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

export async function getGuests(search?: string): Promise<GuestListItem[]> {
  const guests = await prisma.guest.findMany({
    where: {
      fullName: { not: "Maintenance Block" },
      ...(search
        ? {
            OR: [
              { fullName: { contains: search } },
              { contactNumber: { contains: search } },
              { idNumber: { contains: search } },
            ],
          }
        : {}),
    },
    include: {
      _count: { select: { reservations: true } },
    },
    orderBy: { fullName: "asc" },
  });

  return guests.map((g) => ({
    id: g.id,
    fullName: g.fullName,
    contactNumber: g.contactNumber,
    isVip: g.isVip,
    stayCount: g._count.reservations,
  }));
}

export async function getGuestProfile(id: string): Promise<GuestProfile | null> {
  const guest = await prisma.guest.findUnique({
    where: { id },
    include: {
      reservations: {
        where: { bookingType: "GUEST" },
        include: { room: { select: { number: true } } },
        orderBy: { checkIn: "desc" },
      },
    },
  });

  if (!guest || guest.fullName === "Maintenance Block") return null;

  return {
    id: guest.id,
    fullName: guest.fullName,
    contactNumber: guest.contactNumber,
    idType: guest.idType,
    idNumber: guest.idNumber,
    address: guest.address,
    isVip: guest.isVip,
    notes: guest.notes,
    stayHistory: guest.reservations.map((r) => ({
      id: r.id,
      checkIn: r.checkIn.toISOString(),
      checkOut: r.checkOut.toISOString(),
      roomNumber: r.room.number,
      nights: Math.max(1, daysBetween(r.checkIn, r.checkOut)),
      status: r.status,
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
