import { prisma } from "@/lib/db";

export type HotelSettingsData = {
  id: string;
  name: string;
  tagline: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  taxRate: number;
  currencyCode: string;
  receiptFooter: string | null;
};

export async function getHotelSettings(): Promise<HotelSettingsData> {
  let settings = await prisma.hotelSettings.findUnique({ where: { id: "default" } });

  if (!settings) {
    settings = await prisma.hotelSettings.create({
      data: { id: "default" },
    });
  }

  return {
    id: settings.id,
    name: settings.name,
    tagline: settings.tagline,
    address: settings.address,
    phone: settings.phone,
    email: settings.email,
    taxRate: Number(settings.taxRate),
    currencyCode: settings.currencyCode,
    receiptFooter: settings.receiptFooter,
  };
}

export type UpdateHotelSettingsInput = {
  name?: string;
  tagline?: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  taxRate?: number;
  currencyCode?: string;
  receiptFooter?: string | null;
};

export async function updateHotelSettings(input: UpdateHotelSettingsInput) {
  if (input.name !== undefined && !input.name.trim()) {
    throw new Error("Hotel name is required");
  }
  if (input.taxRate != null && (input.taxRate < 0 || input.taxRate > 1)) {
    throw new Error("Tax rate must be between 0 and 1 (e.g. 0.12 for 12%)");
  }

  const settings = await prisma.hotelSettings.update({
    where: { id: "default" },
    data: {
      ...(input.name != null ? { name: input.name.trim() } : {}),
      ...(input.tagline != null ? { tagline: input.tagline.trim() } : {}),
      ...(input.address !== undefined ? { address: input.address } : {}),
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      ...(input.email !== undefined ? { email: input.email } : {}),
      ...(input.taxRate != null ? { taxRate: input.taxRate } : {}),
      ...(input.currencyCode != null ? { currencyCode: input.currencyCode } : {}),
      ...(input.receiptFooter !== undefined ? { receiptFooter: input.receiptFooter } : {}),
    },
  });

  return {
    id: settings.id,
    name: settings.name,
    tagline: settings.tagline,
    address: settings.address,
    phone: settings.phone,
    email: settings.email,
    taxRate: Number(settings.taxRate),
    currencyCode: settings.currencyCode,
    receiptFooter: settings.receiptFooter,
  };
}
