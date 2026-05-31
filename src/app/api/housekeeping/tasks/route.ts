import { getSession } from "@/lib/auth";
import {
  filterCleaningQueueTasks,
  getHousekeepingTasks,
} from "@/lib/housekeeping";
import { isHousekeepingRole } from "@/lib/permissions";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tasks = await getHousekeepingTasks();
  return NextResponse.json(isHousekeepingRole(session.role) ? filterCleaningQueueTasks(tasks) : tasks);
}
