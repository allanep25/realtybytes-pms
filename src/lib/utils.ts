import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Sort room numbers numerically when possible (e.g. 9, 21, 36). */
export function compareRoomNumbers(a: string, b: string): number {
  const numA = Number.parseInt(a, 10);
  const numB = Number.parseInt(b, 10);
  if (!Number.isNaN(numA) && !Number.isNaN(numB)) return numA - numB;
  return a.localeCompare(b, undefined, { numeric: true });
}
