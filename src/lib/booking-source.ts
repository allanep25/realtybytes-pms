import type { BookingPlatform, BookingSource } from "@prisma/client";

export const BOOKING_SOURCE_OPTIONS: { value: BookingSource; label: string }[] = [
  { value: "WALK_IN", label: "Walk-in" },
  { value: "PHONE", label: "Phone call" },
  { value: "EMAIL", label: "Email" },
  { value: "ONLINE", label: "Booked online (OTA / website)" },
  { value: "OTHER", label: "Other" },
];

export const BOOKING_PLATFORM_OPTIONS: { value: BookingPlatform; label: string }[] = [
  { value: "AGODA", label: "Agoda" },
  { value: "BOOKING_COM", label: "Booking.com" },
  { value: "TRIP_COM", label: "Trip.com" },
  { value: "EXPEDIA", label: "Expedia" },
  { value: "HOTELS_COM", label: "Hotels.com" },
  { value: "AIRBNB", label: "Airbnb" },
  { value: "TRAVELOKA", label: "Traveloka" },
  { value: "DIRECT_WEBSITE", label: "Hotel website" },
  { value: "OTHER", label: "Other platform" },
];

export const BOOKING_SOURCE_LABELS: Record<BookingSource, string> = {
  WALK_IN: "Walk-in",
  PHONE: "Phone call",
  EMAIL: "Email",
  ONLINE: "Booked online",
  OTHER: "Other",
};

export const BOOKING_PLATFORM_LABELS: Record<BookingPlatform, string> = {
  AGODA: "Agoda",
  BOOKING_COM: "Booking.com",
  TRIP_COM: "Trip.com",
  EXPEDIA: "Expedia",
  HOTELS_COM: "Hotels.com",
  AIRBNB: "Airbnb",
  TRAVELOKA: "Traveloka",
  DIRECT_WEBSITE: "Hotel website",
  OTHER: "Other platform",
};

export type BookingFieldsInput = {
  bookingSource?: BookingSource;
  bookingPlatform?: BookingPlatform | null;
  bookingReference?: string | null;
};

export function normalizeBookingFields(input: BookingFieldsInput): {
  bookingSource: BookingSource;
  bookingPlatform: BookingPlatform | null;
  bookingReference: string | null;
} {
  const bookingSource = input.bookingSource ?? "PHONE";
  let bookingPlatform = input.bookingPlatform ?? null;
  let bookingReference = input.bookingReference?.trim() || null;

  if (bookingSource !== "ONLINE") {
    bookingPlatform = null;
    bookingReference = null;
  } else {
    if (!bookingPlatform) {
      throw new Error("Select the online booking platform");
    }
    if (!bookingReference) {
      throw new Error("Booking reference number is required for online bookings");
    }
  }

  return { bookingSource, bookingPlatform, bookingReference };
}

export function validateGuestIdAtCheckIn(
  idType?: string | null,
  existingIdType?: string | null,
): void {
  const resolved = idType?.trim() || existingIdType?.trim();
  if (!resolved) {
    throw new Error("ID type is required for the guest checking in");
  }
}

export function formatBookingChannel(
  source: BookingSource,
  platform: BookingPlatform | null,
  reference: string | null,
): string {
  if (source === "ONLINE" && platform) {
    const label = BOOKING_PLATFORM_LABELS[platform];
    return reference ? `${label} · Ref ${reference}` : label;
  }
  return BOOKING_SOURCE_LABELS[source];
}
