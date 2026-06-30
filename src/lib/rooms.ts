import type { RoomGridItem } from "@/components/dashboard/RoomStatusGrid";
import { prisma } from "@/lib/db";
import type { RoomStatus, RoomType } from "@prisma/client";

export type RoomListItem = {
  id: string;
  number: string;
  floor: number;
  type: RoomType;
  description: string;
  maxPax: number;
  status: RoomStatus;
  baseRate: number;
  breakfastRate: number | null;
};

export type RoomFilters = {
  status?: RoomStatus;
  type?: RoomType;
  floor?: number;
  search?: string;
};

export type UpdateRoomInput = {
  number?: string;
  floor?: number;
  status?: RoomStatus;
  type?: RoomType;
  baseRate?: number;
  description?: string;
  maxPax?: number;
  breakfastRate?: number | null;
};

export type CreateRoomInput = {
  number: string;
  floor: number;
  status?: RoomStatus;
  type?: RoomType;
  baseRate: number;
  description?: string;
  maxPax?: number;
  breakfastRate?: number | null;
};

function mapRoom(r: {
  id: string;
  number: string;
  floor: number;
  type: RoomType;
  description: string;
  maxPax: number;
  status: RoomStatus;
  baseRate: { toString(): string };
  breakfastRate: { toString(): string } | null;
}): RoomListItem {
  return {
    id: r.id,
    number: r.number,
    floor: r.floor,
    type: r.type,
    description: r.description,
    maxPax: r.maxPax,
    status: r.status,
    baseRate: Number(r.baseRate),
    breakfastRate: r.breakfastRate != null ? Number(r.breakfastRate) : null,
  };
}

export async function getRooms(filters: RoomFilters = {}): Promise<RoomListItem[]> {
  const { status, type, floor, search } = filters;

  const rooms = await prisma.room.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(type ? { type } : {}),
      ...(floor != null ? { floor } : {}),
      ...(search
        ? {
            OR: [
              { number: { contains: search } },
              { description: { contains: search } },
            ],
          }
        : {}),
    },
    orderBy: [{ floor: "asc" }, { number: "asc" }],
  });

  return rooms.map(mapRoom);
}

export async function getRoomById(id: string) {
  const room = await prisma.room.findUnique({ where: { id } });
  if (!room) return null;
  return mapRoom(room);
}

export async function updateRoom(id: string, input: UpdateRoomInput) {
  const room = await prisma.room.update({
    where: { id },
    data: {
      ...(input.number != null ? { number: input.number } : {}),
      ...(input.floor != null ? { floor: input.floor } : {}),
      ...(input.status != null ? { status: input.status } : {}),
      ...(input.type != null ? { type: input.type } : {}),
      ...(input.baseRate != null ? { baseRate: input.baseRate } : {}),
      ...(input.description != null ? { description: input.description } : {}),
      ...(input.maxPax != null ? { maxPax: input.maxPax } : {}),
      ...(input.breakfastRate !== undefined ? { breakfastRate: input.breakfastRate } : {}),
    },
  });

  return mapRoom(room);
}

export async function createRoom(input: CreateRoomInput) {
  const room = await prisma.room.create({
    data: {
      number: input.number,
      floor: input.floor,
      status: input.status ?? "VACANT",
      type: input.type ?? "STANDARD",
      baseRate: input.baseRate,
      description: input.description ?? "",
      maxPax: input.maxPax ?? 2,
      ...(input.breakfastRate !== undefined ? { breakfastRate: input.breakfastRate } : {}),
    },
  });

  return mapRoom(room);
}

export async function deleteRoom(id: string) {
  const reservationCount = await prisma.reservation.count({ where: { roomId: id } });
  if (reservationCount > 0) {
    throw new Error("Cannot delete a room with reservations");
  }

  await prisma.room.delete({ where: { id } });
  return { ok: true };
}

export function toRoomGridItem(room: RoomListItem): RoomGridItem {
  return {
    id: room.id,
    number: room.number,
    floor: room.floor,
    status: room.status,
    description: room.description,
    maxPax: room.maxPax,
    baseRate: room.baseRate,
    breakfastRate: room.breakfastRate,
  };
}
