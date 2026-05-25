import { prisma } from "@/lib/db";
import { getFolioById } from "@/lib/billing";
import { formatDate } from "@/lib/format";

export type HotelInfo = {
  name: string;
  tagline: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  taxRate: number;
  receiptFooter: string | null;
};

export type ReceiptData = {
  orNumber: string;
  folioNumber: string;
  date: string;
  guestName: string;
  roomNumber: string;
  checkIn: string;
  checkOut: string;
  paymentMethod: string | null;
  lines: { description: string; quantity: number; rate: number; amount: number }[];
  subtotal: number;
  discount: number;
  total: number;
  paid: number;
  hotel: HotelInfo;
};

export async function getHotelInfo(): Promise<HotelInfo> {
  const settings = await prisma.hotelSettings.findUnique({ where: { id: "default" } });
  return {
    name: settings?.name ?? "Amar Residences",
    tagline: settings?.tagline ?? "",
    address: settings?.address ?? null,
    phone: settings?.phone ?? null,
    email: settings?.email ?? null,
    taxRate: Number(settings?.taxRate ?? 0.12),
    receiptFooter: settings?.receiptFooter ?? null,
  };
}

export async function getReceiptFolios() {
  const folios = await prisma.folio.findMany({
    where: {
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
    orderBy: { paidAt: "desc" },
    take: 50,
  });

  return folios.map((f) => ({
    id: f.id,
    folioNumber: f.folioNumber,
    guestName: f.reservation.guest.fullName,
    roomNumber: f.reservation.room.number,
    paid: Number(f.paid),
    paidAt: f.paidAt?.toISOString() ?? null,
  }));
}

export async function getReceiptData(folioId: string): Promise<ReceiptData | null> {
  const folio = await getFolioById(folioId);
  if (!folio) return null;

  const full = await prisma.folio.findUnique({
    where: { id: folioId },
    include: {
      reservation: {
        select: { checkIn: true, checkOut: true },
      },
    },
  });

  if (!full) return null;

  const hotel = await getHotelInfo();
  const orNumber = full.folioNumber.replace(/^F-/, "OR-");

  return {
    orNumber,
    folioNumber: full.folioNumber,
    date: full.paidAt
      ? formatDate(full.paidAt)
      : formatDate(new Date()),
    guestName: folio.guestName,
    roomNumber: folio.roomNumber,
    checkIn: formatDate(full.reservation.checkIn),
    checkOut: formatDate(full.reservation.checkOut),
    paymentMethod: folio.paymentMethod,
    lines: folio.lines,
    subtotal: folio.subtotal,
    discount: folio.discount,
    total: folio.total,
    paid: folio.paid,
    hotel,
  };
}
