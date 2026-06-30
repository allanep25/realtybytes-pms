import { prisma } from "@/lib/db";
import {
  checklistStateFromItems,
  normalizeHousekeepingChecklist,
  type HousekeepingChecklistState,
} from "@/lib/housekeeping-checklist";
import { compareRoomNumbers } from "@/lib/utils";
import { addHotelDays, startOfHotelDay } from "@/lib/dates";
import { Prisma, type HousekeepingStatus, type RoomStatus } from "@prisma/client";

export type HousekeepingTaskItem = {
  id: string;
  roomId: string;
  roomNumber: string;
  roomStatus: RoomStatus;
  status: HousekeepingStatus;
  assignedTo: string | null;
  assignedName: string | null;
  notes: string | null;
  priorityLabel: string | null;
  priorityScore: number;
  checklistItems: string[];
  checklistState: HousekeepingChecklistState;
};

export function isCleaningQueueStatus(status: HousekeepingStatus): boolean {
  return status === "DIRTY" || status === "CLEANING";
}

export function filterCleaningQueueTasks(tasks: HousekeepingTaskItem[]): HousekeepingTaskItem[] {
  return tasks.filter((task) => isCleaningQueueStatus(task.status));
}

function computePriorityScore(input: {
  status: HousekeepingStatus;
  notes: string | null;
  isVip: boolean;
  hasArrivalToday: boolean;
}): { score: number; label: string | null } {
  let score = 0;
  let label: string | null = null;

  if (input.isVip) {
    score += 100;
    label = "VIP arrival";
  } else if (input.hasArrivalToday) {
    score += 60;
    label = "Arrival today";
  }

  if (input.status === "DIRTY") score += 20;
  if (input.notes?.includes("Checked out")) score += 10;

  return { score, label };
}

export async function getHousekeepingTasks(): Promise<HousekeepingTaskItem[]> {
  const today = startOfHotelDay();
  const tomorrow = addHotelDays(today, 1);

  const tasks = await prisma.housekeepingTask.findMany({
    include: {
      room: { select: { number: true, status: true, housekeepingChecklist: true } },
      employee: { select: { name: true } },
    },
    orderBy: { room: { number: "asc" } },
  });

  const roomIds = tasks.map((task) => task.roomId);
  const reservations = roomIds.length
    ? await prisma.reservation.findMany({
        where: {
          roomId: { in: roomIds },
          bookingType: "GUEST",
          status: { in: ["RESERVED", "CHECKED_IN"] },
          checkIn: { lt: tomorrow },
          checkOut: { gt: today },
        },
        include: { guest: { select: { isVip: true } } },
      })
    : [];

  const reservationByRoom = new Map(reservations.map((res) => [res.roomId, res]));

  return tasks
    .map((t) => {
      const reservation = reservationByRoom.get(t.roomId);
      const hasArrivalToday =
        reservation?.status === "RESERVED" &&
        reservation.checkIn >= today &&
        reservation.checkIn < tomorrow;
      const priority = computePriorityScore({
        status: t.status,
        notes: t.notes,
        isVip: reservation?.guest.isVip ?? false,
        hasArrivalToday: Boolean(hasArrivalToday),
      });
      const checklistItems = normalizeHousekeepingChecklist(t.room.housekeepingChecklist);
      const checklistState = checklistStateFromItems(checklistItems, t.checklistState);

      return {
        id: t.id,
        roomId: t.roomId,
        roomNumber: t.room.number,
        roomStatus: t.room.status,
        status: t.status,
        assignedTo: t.assignedTo,
        assignedName: t.employee?.name ?? null,
        notes: t.notes,
        priorityLabel: priority.label,
        priorityScore: priority.score,
        checklistItems,
        checklistState,
      };
    })
    .sort((a, b) => {
      if (a.priorityScore !== b.priorityScore) return b.priorityScore - a.priorityScore;
      const aNeedsCleaning = a.status === "DIRTY" || a.status === "CLEANING";
      const bNeedsCleaning = b.status === "DIRTY" || b.status === "CLEANING";
      if (aNeedsCleaning !== bNeedsCleaning) return aNeedsCleaning ? -1 : 1;
      return compareRoomNumbers(a.roomNumber, b.roomNumber);
    });
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
  checklistState?: HousekeepingChecklistState | null;
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

  const taskData: Prisma.HousekeepingTaskUncheckedUpdateInput = {
    status: input.status,
  };

  if (input.status === "CLEAN") {
    taskData.assignedTo = null;
    taskData.notes = null;
    taskData.checklistState = Prisma.DbNull;
  } else {
    if (input.assignedTo !== undefined) taskData.assignedTo = input.assignedTo;
    if (input.notes !== undefined) taskData.notes = input.notes;
    if (input.checklistState !== undefined) {
      taskData.checklistState = input.checklistState ?? Prisma.DbNull;
    }
  }

  await prisma.$transaction([
    prisma.housekeepingTask.update({
      where: { roomId },
      data: taskData,
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

export async function updateHousekeepingChecklist(
  roomId: string,
  checklistState: HousekeepingChecklistState,
) {
  const task = await prisma.housekeepingTask.findUnique({ where: { roomId } });
  if (!task) throw new Error("Task not found");

  await prisma.housekeepingTask.update({
    where: { roomId },
    data: { checklistState },
  });

  const tasks = await getHousekeepingTasks();
  return tasks.find((t) => t.roomId === roomId)!;
}
