/** Hourly extension = (nightly rate ÷ 24) + 20% */
export const HOURLY_EXTENSION_MARKUP = 1.2;

export type StayQuote = {
  nights: number;
  nightlyRate: number;
  hourlyExtensionRate: number;
  baseStayTotal: number;
  extensionDays: number;
  extensionDaysTotal: number;
  extensionHours: number;
  extensionHoursTotal: number;
  totalDue: number;
};

export type FolioLineInput = {
  description: string;
  quantity: number;
  rate: number;
  amount: number;
};

function roundMoney(amount: number): number {
  return Math.round(amount * 100) / 100;
}

export function calcNightsFromDates(checkIn: string, checkOut: string): number {
  const [y1, m1, d1] = checkIn.split("-").map(Number);
  const [y2, m2, d2] = checkOut.split("-").map(Number);
  const start = new Date(y1, m1 - 1, d1);
  const end = new Date(y2, m2 - 1, d2);
  const diff = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff);
}

export function calcHourlyExtensionRate(nightlyRate: number): number {
  return roundMoney((nightlyRate / 24) * HOURLY_EXTENSION_MARKUP);
}

export function calcStayQuote(params: {
  nightlyRate: number;
  checkIn: string;
  checkOut: string;
  extensionDays?: number;
  extensionHours?: number;
}): StayQuote | null {
  const { nightlyRate, checkIn, checkOut } = params;
  if (!checkIn || !checkOut || nightlyRate <= 0) return null;

  const nights = calcNightsFromDates(checkIn, checkOut);
  if (nights < 1) return null;

  const extensionDays = Math.max(0, Math.floor(params.extensionDays ?? 0));
  const extensionHours = Math.max(0, Math.floor(params.extensionHours ?? 0));
  const hourlyExtensionRate = calcHourlyExtensionRate(nightlyRate);

  const baseStayTotal = roundMoney(nights * nightlyRate);
  const extensionDaysTotal = roundMoney(extensionDays * nightlyRate);
  const extensionHoursTotal = roundMoney(extensionHours * hourlyExtensionRate);
  const totalDue = roundMoney(baseStayTotal + extensionDaysTotal + extensionHoursTotal);

  return {
    nights,
    nightlyRate,
    hourlyExtensionRate,
    baseStayTotal,
    extensionDays,
    extensionDaysTotal,
    extensionHours,
    extensionHoursTotal,
    totalDue,
  };
}

export function buildStayFolioLines(params: {
  roomNumber: string;
  nightlyRate: number;
  nights: number;
  extensionDays: number;
  extensionHours: number;
}): FolioLineInput[] {
  const hourlyRate = calcHourlyExtensionRate(params.nightlyRate);
  const lines: FolioLineInput[] = [];

  lines.push({
    description: `Room ${params.roomNumber} — ${params.nights} night${params.nights > 1 ? "s" : ""}`,
    quantity: params.nights,
    rate: params.nightlyRate,
    amount: roundMoney(params.nights * params.nightlyRate),
  });

  if (params.extensionDays > 0) {
    lines.push({
      description: `Day extension — Room ${params.roomNumber}`,
      quantity: params.extensionDays,
      rate: params.nightlyRate,
      amount: roundMoney(params.extensionDays * params.nightlyRate),
    });
  }

  if (params.extensionHours > 0) {
    lines.push({
      description: `Hour extension — Room ${params.roomNumber}`,
      quantity: params.extensionHours,
      rate: hourlyRate,
      amount: roundMoney(params.extensionHours * hourlyRate),
    });
  }

  return lines;
}

export function folioLinesTotal(lines: FolioLineInput[]): number {
  return roundMoney(lines.reduce((sum, line) => sum + line.amount, 0));
}
