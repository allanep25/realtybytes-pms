import { prisma } from "@/lib/db";
import { recordFolioPayment } from "@/lib/folio-payments";
import type { PaymentMethod } from "@prisma/client";

export type FolioListItem = {
  id: string;
  folioNumber: string;
  guestName: string;
  roomNumber: string;
  total: number;
  paid: number;
  balanceDue: number;
  status: string;
};

export type FolioLineItem = {
  id: string;
  description: string;
  quantity: number;
  rate: number;
  amount: number;
};

export type FolioDetail = {
  id: string;
  folioNumber: string;
  guestName: string;
  roomNumber: string;
  reservationStatus: string;
  paymentMethod: PaymentMethod | null;
  subtotal: number;
  discount: number;
  total: number;
  paid: number;
  balanceDue: number;
  lines: FolioLineItem[];
};

export type AddLineInput = {
  description: string;
  quantity: number;
  rate: number;
};

export type UpdateFolioInput = {
  discount?: number;
  paymentMethod?: PaymentMethod;
  paymentAmount?: number;
};

async function recalculateFolio(folioId: string) {
  const lines = await prisma.folioLine.findMany({ where: { folioId } });
  const subtotal = lines.reduce((sum, line) => sum + Number(line.amount), 0);

  const folio = await prisma.folio.findUniqueOrThrow({ where: { id: folioId } });
  const discount = Number(folio.discount);
  const total = Math.max(0, subtotal - discount);

  await prisma.folio.update({
    where: { id: folioId },
    data: { subtotal, total },
  });

  return { subtotal, discount, total };
}

function mapFolioDetail(
  folio: {
    id: string;
    folioNumber: string;
    paymentMethod: PaymentMethod | null;
    subtotal: unknown;
    discount: unknown;
    total: unknown;
    paid: unknown;
    lines: { id: string; description: string; quantity: number; rate: unknown; amount: unknown }[];
    reservation: {
      status: string;
      guest: { fullName: string };
      room: { number: string };
    };
  },
): FolioDetail {
  const subtotal = Number(folio.subtotal);
  const discount = Number(folio.discount);
  const total = Number(folio.total);
  const paid = Number(folio.paid);

  return {
    id: folio.id,
    folioNumber: folio.folioNumber,
    guestName: folio.reservation.guest.fullName,
    roomNumber: folio.reservation.room.number,
    reservationStatus: folio.reservation.status,
    paymentMethod: folio.paymentMethod,
    subtotal,
    discount,
    total,
    paid,
    balanceDue: Math.max(0, total - paid),
    lines: folio.lines.map((l) => ({
      id: l.id,
      description: l.description,
      quantity: l.quantity,
      rate: Number(l.rate),
      amount: Number(l.amount),
    })),
  };
}

const folioInclude = {
  lines: { orderBy: { id: "asc" as const } },
  reservation: {
    include: {
      guest: { select: { fullName: true } },
      room: { select: { number: true } },
    },
  },
};

export async function getOpenFolios(): Promise<FolioListItem[]> {
  const folios = await prisma.folio.findMany({
    where: {
      reservation: {
        status: { in: ["CHECKED_IN", "RESERVED"] },
        bookingType: "GUEST",
      },
    },
    include: folioInclude,
    orderBy: { folioNumber: "desc" },
  });

  return folios.map((f) => {
    const total = Number(f.total);
    const paid = Number(f.paid);
    return {
      id: f.id,
      folioNumber: f.folioNumber,
      guestName: f.reservation.guest.fullName,
      roomNumber: f.reservation.room.number,
      total,
      paid,
      balanceDue: Math.max(0, total - paid),
      status: f.reservation.status,
    };
  });
}

export async function getAllFolios(): Promise<FolioListItem[]> {
  const folios = await prisma.folio.findMany({
    where: {
      reservation: { bookingType: "GUEST" },
    },
    include: folioInclude,
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return folios.map((f) => {
    const total = Number(f.total);
    const paid = Number(f.paid);
    return {
      id: f.id,
      folioNumber: f.folioNumber,
      guestName: f.reservation.guest.fullName,
      roomNumber: f.reservation.room.number,
      total,
      paid,
      balanceDue: Math.max(0, total - paid),
      status: f.reservation.status,
    };
  });
}

export async function getFolioById(id: string): Promise<FolioDetail | null> {
  const folio = await prisma.folio.findUnique({
    where: { id },
    include: folioInclude,
  });

  if (!folio) return null;
  return mapFolioDetail(folio);
}

export async function getFolioByNumber(folioNumber: string): Promise<FolioDetail | null> {
  const folio = await prisma.folio.findUnique({
    where: { folioNumber },
    include: folioInclude,
  });

  if (!folio) return null;
  return mapFolioDetail(folio);
}

export async function addFolioLine(folioId: string, input: AddLineInput) {
  if (!input.description.trim()) throw new Error("Description is required");
  const quantity = Math.max(1, input.quantity || 1);
  const rate = Math.max(0, input.rate || 0);
  const amount = quantity * rate;

  await prisma.folioLine.create({
    data: {
      folioId,
      description: input.description.trim(),
      quantity,
      rate,
      amount,
    },
  });

  await recalculateFolio(folioId);
  return getFolioById(folioId);
}

export async function removeFolioLine(lineId: string) {
  const line = await prisma.folioLine.findUnique({ where: { id: lineId } });
  if (!line) throw new Error("Line item not found");

  await prisma.folioLine.delete({ where: { id: lineId } });
  await recalculateFolio(line.folioId);
  return getFolioById(line.folioId);
}

export async function updateFolio(folioId: string, input: UpdateFolioInput) {
  if (input.discount != null) {
    const lines = await prisma.folioLine.findMany({ where: { folioId } });
    const subtotal = lines.reduce((s, l) => s + Number(l.amount), 0);
    const discount = Math.max(0, Math.min(input.discount, subtotal));
    await prisma.folio.update({
      where: { id: folioId },
      data: {
        discount,
        subtotal,
        total: Math.max(0, subtotal - discount),
      },
    });
  }

  const folio = await prisma.folio.findUniqueOrThrow({ where: { id: folioId } });
  const total = Number(folio.total);
  let paid = Number(folio.paid);

  if (input.paymentAmount != null && input.paymentAmount > 0) {
    const method = input.paymentMethod ?? folio.paymentMethod ?? "CASH";
    paid = Math.min(paid + input.paymentAmount, total);
    await recordFolioPayment(folioId, input.paymentAmount, method);
    await prisma.folio.update({
      where: { id: folioId },
      data: {
        paid,
        paidAt: new Date(),
        paymentMethod: method,
      },
    });
  } else if (input.paymentMethod) {
    await prisma.folio.update({
      where: { id: folioId },
      data: { paymentMethod: input.paymentMethod },
    });
  }

  return getFolioById(folioId);
}

export const CHARGE_PRESETS = [
  { description: "Extra Bed", rate: 800 },
  { description: "Breakfast", rate: 350 },
  { description: "Laundry", rate: 250 },
  { description: "Minibar", rate: 500 },
];
