export type HousekeepingChecklistState = Record<string, boolean>;

export function normalizeHousekeepingChecklist(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const items: string[] = [];

  for (const entry of value) {
    if (typeof entry !== "string") continue;
    const item = entry.trim();
    if (!item) continue;

    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(item);
  }

  return items;
}

export function checklistStateFromItems(
  items: string[],
  state?: unknown,
): HousekeepingChecklistState {
  const current = state && typeof state === "object" ? (state as Record<string, unknown>) : {};
  const next: HousekeepingChecklistState = {};

  for (const item of items) {
    next[item] = Boolean(current[item]);
  }

  return next;
}
