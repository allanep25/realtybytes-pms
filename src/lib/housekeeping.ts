import { prisma } from "@/lib/db";
import type { HousekeepingStatus, RoomStatus } from "@prisma/client";

export type HousekeepingTaskItem = {
  id: string;
  roomId: string;
  roomNumber: string;
  roomStatus: RoomStatus;
  status: HousekeepingStatus;
  assignedTo: string | null;
  assignedName: string | null;
  notes: string | null;
};

export async function getHousekeepingTasks(): Promise<HousekeepingTaskItem[]> {
  const tasks = await prisma.housekeepingTask.findMany({
    include: {
      room: { select: { number: true, status: true } },
      employee: { select: { name: true } },
    },
    orderBy: { room: { number: "asc" } },
  });

  return tasks.map((t) => ({
    id: t.id,
    roomId: t.roomId,
    roomNumber: t.room.number,
    roomStatus: t.room.status,
    status: t.status,
    assignedTo: t.assignedTo,
    assignedName: t.employee?.name ?? null,
    notes: t.notes,
  }));
}

export async function getHousekeepingStaff() {
  return prisma.employee.findMany({
    where: {
      role: "HOUSEKEEPING",
      status: "ACTIVE",
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

type UpdateTaskInput = {
  status: HousekeepingStatus;
  assignedTo?: string | null;
  notes?: string | null;
};

export async function updateHousekeepingTask(roomId: string, input: UpdateTaskInput) {
  const room = await prisma.room.findUnique({ where: { id: roomId } });
  if (!room) throw new Error("Room not found");

  let roomStatus: RoomStatus = room.status;

  switch (input.status) {
    case "CLEAN":
      roomStatus = room.status === "OCCUPIED" || room.status === "RESERVED" ? room.status : "VACANT";
      break;
    case "DIRTY":
    case "CLEANING":
      roomStatus = room.status === "OCCUPIED" ? "OCCUPIED" : "DIRTY";
      break;
    case "OUT_OF_ORDER":
      roomStatus = "OUT_OF_ORDER";
      break;
  }

  await prisma.$transaction([
    prisma.housekeepingTask.update({
      where: { roomId },
      data: {
        status: input.status,
        assignedTo: input.assignedTo ?? null,
        notes: input.notes ?? null,
      },
    }),
    prisma.room.update({
      where: { id: roomId },
      data: { status: roomStatus },
    }),
  ]);

  const tasks = await getHousekeepingTasks();
  return tasks.find((t) => t.roomId === roomId)!;
}

export async function assignHousekeepingTask(roomId: string, employeeId: string | null) {
  const task = await prisma.housekeepingTask.findUnique({ where: { roomId } });
  if (!task) throw new Error("Task not found");

  return updateHousekeepingTask(roomId, {
    status: task.status === "DIRTY" ? "CLEANING" : task.status,
    assignedTo: employeeId,
    notes: task.notes,
  });
}
