import { prisma } from "@/lib/db";
import type { PaymentMethod } from "@prisma/client";

export async function recordFolioPayment(
  folioId: string,
  amount: number,
  method: PaymentMethod,
  paidAt: Date = new Date(),
) {
  if (amount <= 0) return;

  await prisma.folioPayment.create({
    data: {
      folioId,
      amount,
      method,
      paidAt,
    },
  });
}
