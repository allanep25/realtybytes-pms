import { PAYMENT_METHOD_OPTIONS } from "@/lib/constants";
import type { PaymentMethod } from "@prisma/client";

const PAYMENT_METHOD_VALUES = new Set<string>(
  PAYMENT_METHOD_OPTIONS.map((option) => option.value),
);

export function paymentMethodLabel(method: string): string {
  return PAYMENT_METHOD_OPTIONS.find((option) => option.value === method)?.label ?? method;
}

/** Normalize API / form values to a valid PaymentMethod, or null if missing/invalid. */
export function normalizePaymentMethod(value: unknown): PaymentMethod | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toUpperCase();
  if (!PAYMENT_METHOD_VALUES.has(trimmed)) return null;
  return trimmed as PaymentMethod;
}

export function requirePaymentMethodForAmount(
  amount: number,
  value: unknown,
): PaymentMethod {
  const normalized = normalizePaymentMethod(value);
  if (amount > 0 && !normalized) {
    throw new Error("Select a payment method for this payment");
  }
  return normalized ?? "CASH";
}
