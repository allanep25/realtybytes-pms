import { prisma } from "@/lib/db";
import { hotelCalendarDate } from "@/lib/dates";
import { normalizePaymentMethod } from "@/lib/payment-method";
import type { ExpenseCategory, PaymentMethod } from "@prisma/client";

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  SUPPLIES: "Supplies",
  MAINTENANCE: "Maintenance",
  FOOD_BEVERAGE: "Food & beverage",
  TRANSPORT: "Transport",
  UTILITIES: "Utilities",
  SALARY: "Salary / allowance",
  OTHER: "Other",
};

export const EXPENSE_CATEGORY_OPTIONS = Object.entries(EXPENSE_CATEGORY_LABELS).map(
  ([value, label]) => ({ value: value as ExpenseCategory, label }),
);

export type ExpenseItem = {
  id: string;
  businessDate: string;
  spentAt: string;
  amount: number;
  method: PaymentMethod;
  category: ExpenseCategory;
  categoryLabel: string;
  description: string;
  vendor: string | null;
  recordedByName: string;
};

export type ExpenseSummary = {
  date: string;
  total: number;
  items: ExpenseItem[];
  totalsByMethod: Record<PaymentMethod, number>;
};

export type CreateExpenseInput = {
  businessDate?: string;
  amount?: number;
  method?: PaymentMethod | string | null;
  category?: ExpenseCategory | string | null;
  description?: string;
  vendor?: string | null;
};

const EXPENSE_CATEGORIES = new Set(Object.keys(EXPENSE_CATEGORY_LABELS));

function normalizeCategory(value: unknown): ExpenseCategory {
  if (typeof value !== "string") return "OTHER";
  const normalized = value.trim().toUpperCase();
  return EXPENSE_CATEGORIES.has(normalized) ? (normalized as ExpenseCategory) : "OTHER";
}

function mapExpense(expense: {
  id: string;
  businessDate: string;
  spentAt: Date;
  amount: unknown;
  method: PaymentMethod;
  category: ExpenseCategory;
  description: string;
  vendor: string | null;
  recordedBy: { name: string };
}): ExpenseItem {
  return {
    id: expense.id,
    businessDate: expense.businessDate,
    spentAt: expense.spentAt.toISOString(),
    amount: Number(expense.amount),
    method: expense.method,
    category: expense.category,
    categoryLabel: EXPENSE_CATEGORY_LABELS[expense.category],
    description: expense.description,
    vendor: expense.vendor,
    recordedByName: expense.recordedBy.name,
  };
}

export async function getExpensesForDate(date: string): Promise<ExpenseSummary> {
  const items = await prisma.expense.findMany({
    where: { businessDate: date },
    include: { recordedBy: { select: { name: true } } },
    orderBy: { spentAt: "desc" },
  });

  const mapped = items.map(mapExpense);
  const totalsByMethod: Record<PaymentMethod, number> = {
    CASH: 0,
    GCASH: 0,
    CARD: 0,
    BANK_TRANSFER: 0,
  };

  for (const item of mapped) {
    totalsByMethod[item.method] += item.amount;
  }

  return {
    date,
    items: mapped,
    totalsByMethod,
    total: mapped.reduce((sum, item) => sum + item.amount, 0),
  };
}

export async function getExpenseRowsForPeriod(from: string, to: string): Promise<ExpenseItem[]> {
  const items = await prisma.expense.findMany({
    where: { businessDate: { gte: from, lte: to } },
    include: { recordedBy: { select: { name: true } } },
    orderBy: { spentAt: "desc" },
  });

  return items.map(mapExpense);
}

export async function createExpense(
  input: CreateExpenseInput,
  recordedById: string,
): Promise<ExpenseItem> {
  const amount = Math.max(0, Number(input.amount) || 0);
  if (amount <= 0) throw new Error("Enter an expense amount");

  const description = input.description?.trim();
  if (!description) throw new Error("Expense description is required");

  const method = normalizePaymentMethod(input.method ?? "CASH") ?? "CASH";
  const category = normalizeCategory(input.category);

  const expense = await prisma.expense.create({
    data: {
      businessDate: input.businessDate || hotelCalendarDate(),
      amount,
      method,
      category,
      description,
      vendor: input.vendor?.trim() || null,
      recordedById,
    },
    include: { recordedBy: { select: { name: true } } },
  });

  return mapExpense(expense);
}
