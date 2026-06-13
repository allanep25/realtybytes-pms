import { prisma } from "@/lib/db";
import { hotelCalendarDate } from "@/lib/dates";
import ExcelJS from "exceljs";

export type KeycardRowStatus = "MATCHED" | "KEYCARD_NO_BOOKING" | "BOOKING_NO_KEYCARD";

export type KeycardEntry = {
  room: string;
  guest: string | null;
  issuedKey: string | null;
  expiresKey: string | null;
};

export type KeycardReconRow = {
  room: string;
  checkIn: string;
  departure: string;
  guest: string;
  note: string;
  status: KeycardRowStatus;
};

export type KeycardReconResult = {
  from: string;
  to: string;
  totalCards: number;
  matched: number;
  keycardNoBooking: number;
  bookingNoKeycard: number;
  parsedRows: number;
  rows: KeycardReconRow[];
};

const STATUS_LABELS: Record<KeycardRowStatus, string> = {
  MATCHED: "Matched",
  KEYCARD_NO_BOOKING: "Keycard, no booking",
  BOOKING_NO_KEYCARD: "Booking, no keycard",
};

export function keycardStatusLabel(status: KeycardRowStatus): string {
  return STATUS_LABELS[status];
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Extract a YYYY-MM-DD calendar date from a keycard cell.
 * Keycard exports store naive wall-clock datetimes (hotel local time), so we read
 * the wall-clock date directly rather than applying any timezone conversion.
 */
function cellToDateKey(value: ExcelJS.CellValue): string | null {
  if (value == null) return null;
  if (value instanceof Date) {
    // exceljs stores naive datetimes as UTC; read the UTC wall-clock date.
    return `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())}`;
  }
  if (typeof value === "number") {
    // Excel serial date (days since 1899-12-30).
    const d = new Date(Math.round((value - 25569) * 86_400_000));
    if (Number.isNaN(d.getTime())) return null;
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  }
  if (typeof value === "object" && "text" in value && typeof value.text === "string") {
    return cellToDateKey(value.text);
  }
  if (typeof value === "string") {
    const match = value.trim().match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (match) return `${match[1]}-${pad(Number(match[2]))}-${pad(Number(match[3]))}`;
    const slash = value.trim().match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (slash) return `${slash[3]}-${pad(Number(slash[1]))}-${pad(Number(slash[2]))}`;
    return null;
  }
  return null;
}

function cellToString(value: ExcelJS.CellValue): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  if (value instanceof Date) return hotelCalendarDate(value);
  if (typeof value === "object" && "text" in value && typeof value.text === "string") {
    return value.text.trim();
  }
  if (typeof value === "object" && "result" in value) {
    return cellToString((value as ExcelJS.CellFormulaValue).result ?? "");
  }
  return String(value);
}

function normalizeRoom(value: ExcelJS.CellValue): string {
  const raw = cellToString(value);
  // Room numbers may arrive as "36", "36.0", or "Rm 36" — keep the digits.
  const digits = raw.match(/\d+/);
  return digits ? digits[0] : raw;
}

type ColumnMap = {
  room: number;
  issued: number;
  expires: number;
  guest: number;
};

function buildColumnMap(headerRow: ExcelJS.Row): ColumnMap | null {
  const map: ColumnMap = { room: -1, issued: -1, expires: -1, guest: -1 };
  headerRow.eachCell((cell, col) => {
    const header = cellToString(cell.value).toLowerCase();
    if (!header) return;
    if (map.room === -1 && /room\s*no/.test(header)) map.room = col;
    else if (map.issued === -1 && /check\s*[- ]?in/.test(header)) map.issued = col;
    else if (map.expires === -1 && /departure/.test(header)) map.expires = col;
    else if (map.guest === -1 && /^guest$/.test(header)) map.guest = col;
  });
  if (map.room === -1 || map.issued === -1 || map.expires === -1) return null;
  return map;
}

export async function parseKeycardWorkbook(buffer: ArrayBuffer): Promise<KeycardEntry[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error("The uploaded file has no worksheet.");

  const headerRow = sheet.getRow(1);
  const columns = buildColumnMap(headerRow);
  if (!columns) {
    throw new Error(
      "Could not find the required columns. Expected headers including \"Room No.\", \"Check in Time\", and \"Departure Time\".",
    );
  }

  const entries: KeycardEntry[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const room = normalizeRoom(row.getCell(columns.room).value);
    if (!room) return;
    const issuedKey = cellToDateKey(row.getCell(columns.issued).value);
    const expiresKey = cellToDateKey(row.getCell(columns.expires).value);
    if (!issuedKey && !expiresKey) return;
    const guest = columns.guest > 0 ? cellToString(row.getCell(columns.guest).value) || null : null;
    entries.push({ room, guest, issuedKey, expiresKey });
  });

  return entries;
}

function rangesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  return aStart <= bEnd && aEnd >= bStart;
}

export async function reconcileKeycards(
  entries: KeycardEntry[],
  fromStr: string,
  toStr: string,
): Promise<KeycardReconResult> {
  const from = new Date(`${fromStr}T00:00:00+08:00`);
  const toExclusive = new Date(`${toStr}T00:00:00+08:00`);
  toExclusive.setDate(toExclusive.getDate() + 1);

  const reservations = await prisma.reservation.findMany({
    where: {
      status: { notIn: ["CANCELLED", "NO_SHOW"] },
      checkIn: { lt: toExclusive },
      checkOut: { gt: from },
    },
    include: {
      guest: { select: { fullName: true } },
      room: { select: { number: true } },
    },
    orderBy: [{ room: { number: "asc" } }, { checkIn: "asc" }],
  });

  const reservationViews = reservations.map((res) => ({
    room: res.room.number,
    guest: res.guest?.fullName ?? "—",
    startKey: hotelCalendarDate(res.checkIn),
    endKey: hotelCalendarDate(res.checkOut),
    matched: false,
  }));

  const rows: KeycardReconRow[] = [];
  let matched = 0;
  let keycardNoBooking = 0;

  for (const entry of entries) {
    const issuedKey = entry.issuedKey ?? entry.expiresKey ?? "";
    const expiresKey = entry.expiresKey ?? entry.issuedKey ?? issuedKey;

    const hit = reservationViews.find(
      (res) =>
        res.room === entry.room &&
        issuedKey !== "" &&
        rangesOverlap(issuedKey, expiresKey, res.startKey, res.endKey),
    );

    if (hit) {
      hit.matched = true;
      matched += 1;
      rows.push({
        room: entry.room,
        checkIn: issuedKey,
        departure: expiresKey,
        guest: hit.guest,
        note: `Matched booking ${hit.startKey} → ${hit.endKey}`,
        status: "MATCHED",
      });
    } else {
      keycardNoBooking += 1;
      rows.push({
        room: entry.room,
        checkIn: issuedKey,
        departure: expiresKey,
        guest: entry.guest ?? "",
        note: "No PMS booking found for this room/date",
        status: "KEYCARD_NO_BOOKING",
      });
    }
  }

  let bookingNoKeycard = 0;
  for (const res of reservationViews) {
    if (res.matched) continue;
    bookingNoKeycard += 1;
    rows.push({
      room: res.room,
      checkIn: res.startKey,
      departure: res.endKey,
      guest: res.guest,
      note: "Recorded stay · no matching keycard issued",
      status: "BOOKING_NO_KEYCARD",
    });
  }

  rows.sort((a, b) => {
    if (a.checkIn !== b.checkIn) return a.checkIn.localeCompare(b.checkIn);
    return a.room.localeCompare(b.room, undefined, { numeric: true });
  });

  return {
    from: fromStr,
    to: toStr,
    totalCards: entries.length,
    matched,
    keycardNoBooking,
    bookingNoKeycard,
    parsedRows: entries.length,
    rows,
  };
}
