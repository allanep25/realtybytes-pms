import { prisma } from "@/lib/db";
import type { PaymentMethod } from "@prisma/client";
import { normalizePaymentMethod } from "@/lib/payment-method";

export async function recordFolioPayment(
  folioId: string,
  amount: number,
  method: PaymentMethod,
  paidAt: Date = new Date(),
) {
  if (amount <= 0) return;

  const normalized = normalizePaymentMethod(method);
  if (!normalized) {
    throw new Error("Select a valid payment method for this payment");
  }

  await prisma.folioPayment.create({
    data: {
      folioId,
      amount,
      method: normalized,
      paidAt,
    },
  });
}
