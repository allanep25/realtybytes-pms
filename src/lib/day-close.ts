import { prisma } from "@/lib/db";
import { getRevenueForPeriod } from "@/lib/revenue";

export type DayCloseSummary = {
  businessDate: string;
  expected: {
    cash: number;
    gcash: number;
    card: number;
    bankTransfer: number;
    total: number;
  };
  actual: {
    cash: number | null;
    gcash: number | null;
    card: number | null;
    bankTransfer: number | null;
  } | null;
  notes: string | null;
  closedAt: string | null;
  closedByName: string | null;
};

export async function getDayCloseSummary(businessDate: string): Promise<DayCloseSummary> {
  const revenue = await getRevenueForPeriod(businessDate, businessDate);
  const expected = {
    cash: revenue.breakdown.find((b) => b.method === "CASH")?.amount ?? 0,
    gcash: revenue.breakdown.find((b) => b.method === "GCASH")?.amount ?? 0,
    card: revenue.breakdown.find((b) => b.method === "CARD")?.amount ?? 0,
    bankTransfer: revenue.breakdown.find((b) => b.method === "BANK_TRANSFER")?.amount ?? 0,
    total: revenue.total,
  };

  const record = await prisma.dayCloseRecord.findUnique({
    where: { businessDate },
    include: { closedBy: { select: { name: true } } },
  });

  if (!record) {
    return {
      businessDate,
      expected,
      actual: null,
      notes: null,
      closedAt: null,
      closedByName: null,
    };
  }

  return {
    businessDate,
    expected: {
      cash: Number(record.expectedCash),
      gcash: Number(record.expectedGcash),
      card: Number(record.expectedCard),
      bankTransfer: Number(record.expectedBankTransfer),
      total:
        Number(record.expectedCash) +
        Number(record.expectedGcash) +
        Number(record.expectedCard) +
        Number(record.expectedBankTransfer),
    },
    actual: {
      cash: record.actualCash != null ? Number(record.actualCash) : null,
      gcash: record.actualGcash != null ? Number(record.actualGcash) : null,
      card: record.actualCard != null ? Number(record.actualCard) : null,
      bankTransfer:
        record.actualBankTransfer != null ? Number(record.actualBankTransfer) : null,
    },
    notes: record.notes,
    closedAt: record.closedAt.toISOString(),
    closedByName: record.closedBy.name,
  };
}

export type SaveDayCloseInput = {
  businessDate: string;
  actualCash: number;
  actualGcash: number;
  actualCard: number;
  actualBankTransfer: number;
  notes?: string;
};

export async function saveDayClose(input: SaveDayCloseInput, closedById: string) {
  const revenue = await getRevenueForPeriod(input.businessDate, input.businessDate);

  return prisma.dayCloseRecord.upsert({
    where: { businessDate: input.businessDate },
    create: {
      businessDate: input.businessDate,
      expectedCash: revenue.breakdown.find((b) => b.method === "CASH")?.amount ?? 0,
      expectedGcash: revenue.breakdown.find((b) => b.method === "GCASH")?.amount ?? 0,
      expectedCard: revenue.breakdown.find((b) => b.method === "CARD")?.amount ?? 0,
      expectedBankTransfer:
        revenue.breakdown.find((b) => b.method === "BANK_TRANSFER")?.amount ?? 0,
      actualCash: input.actualCash,
      actualGcash: input.actualGcash,
      actualCard: input.actualCard,
      actualBankTransfer: input.actualBankTransfer,
      notes: input.notes?.trim() || null,
      closedById,
    },
    update: {
      expectedCash: revenue.breakdown.find((b) => b.method === "CASH")?.amount ?? 0,
      expectedGcash: revenue.breakdown.find((b) => b.method === "GCASH")?.amount ?? 0,
      expectedCard: revenue.breakdown.find((b) => b.method === "CARD")?.amount ?? 0,
      expectedBankTransfer:
        revenue.breakdown.find((b) => b.method === "BANK_TRANSFER")?.amount ?? 0,
      actualCash: input.actualCash,
      actualGcash: input.actualGcash,
      actualCard: input.actualCard,
      actualBankTransfer: input.actualBankTransfer,
      notes: input.notes?.trim() || null,
      closedById,
      closedAt: new Date(),
    },
  });
}
