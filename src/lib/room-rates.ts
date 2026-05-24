import type { RoomType } from "@prisma/client";

/** Official room catalog — Amar Residence (from rate sheet) */
export type RoomCatalogEntry = {
  number: string;
  floor: number;
  description: string;
  maxPax: number;
  regularRate: number;
  breakfastRate: number | null;
  type: RoomType;
};

export const ROOM_CATALOG: Record<string, RoomCatalogEntry> = {
  "21": {
    number: "21",
    floor: 2,
    description: "Family Suite",
    maxPax: 7,
    regularRate: 5100,
    breakfastRate: null,
    type: "SUITE",
  },
  "22": {
    number: "22",
    floor: 2,
    description: "Big Deluxe",
    maxPax: 3,
    regularRate: 2600,
    breakfastRate: 3230,
    type: "DELUXE",
  },
  "23": {
    number: "23",
    floor: 2,
    description: "Big Deluxe",
    maxPax: 3,
    regularRate: 2600,
    breakfastRate: 3230,
    type: "DELUXE",
  },
  "24": {
    number: "24",
    floor: 2,
    description: "Big Deluxe",
    maxPax: 3,
    regularRate: 2600,
    breakfastRate: 3230,
    type: "DELUXE",
  },
  "25": {
    number: "25",
    floor: 2,
    description: "Big Deluxe",
    maxPax: 4,
    regularRate: 2600,
    breakfastRate: 3440,
    type: "DELUXE",
  },
  "26": {
    number: "26",
    floor: 2,
    description: "Small Deluxe",
    maxPax: 2,
    regularRate: 1950,
    breakfastRate: 2220,
    type: "DELUXE",
  },
  "27": {
    number: "27",
    floor: 2,
    description: "Premier Room",
    maxPax: 4,
    regularRate: 3400,
    breakfastRate: 4240,
    type: "DELUXE",
  },
  "28": {
    number: "28",
    floor: 2,
    description: "Premier Room",
    maxPax: 3,
    regularRate: 2800,
    breakfastRate: 3430,
    type: "DELUXE",
  },
  "31": {
    number: "31",
    floor: 3,
    description: "Family Suite",
    maxPax: 6,
    regularRate: 3900,
    breakfastRate: null,
    type: "SUITE",
  },
  "32": {
    number: "32",
    floor: 3,
    description: "Bunkbeds",
    maxPax: 6,
    regularRate: 3550,
    breakfastRate: null,
    type: "STANDARD",
  },
  "33": {
    number: "33",
    floor: 3,
    description: "Bunkbeds",
    maxPax: 6,
    regularRate: 3750,
    breakfastRate: null,
    type: "STANDARD",
  },
  "34": {
    number: "34",
    floor: 3,
    description: "Bunkbeds",
    maxPax: 4,
    regularRate: 2600,
    breakfastRate: null,
    type: "STANDARD",
  },
  "35": {
    number: "35",
    floor: 3,
    description: "Bunkbeds",
    maxPax: 4,
    regularRate: 2600,
    breakfastRate: null,
    type: "STANDARD",
  },
  "36": {
    number: "36",
    floor: 3,
    description: "Small Deluxe",
    maxPax: 2,
    regularRate: 1950,
    breakfastRate: 2220,
    type: "DELUXE",
  },
  "37": {
    number: "37",
    floor: 3,
    description: "Premier Room",
    maxPax: 4,
    regularRate: 3400,
    breakfastRate: 4240,
    type: "DELUXE",
  },
  "38": {
    number: "38",
    floor: 3,
    description: "Premier Room",
    maxPax: 3,
    regularRate: 2800,
    breakfastRate: 3430,
    type: "DELUXE",
  },
};

export const ROOM_NUMBERS = [
  "21", "22", "23", "24", "25", "26", "27", "28",
  "31", "32", "33", "34", "35", "36", "37", "38",
] as const;

/** @deprecated Use ROOM_CATALOG[number].regularRate */
export const ROOM_RATES: Record<string, number> = Object.fromEntries(
  Object.entries(ROOM_CATALOG).map(([n, e]) => [n, e.regularRate]),
);

export function getRoomCatalogEntry(number: string): RoomCatalogEntry {
  const entry = ROOM_CATALOG[number];
  if (entry) return entry;
  return {
    number,
    floor: Number(number) < 30 ? 2 : 3,
    description: "Standard Room",
    maxPax: 2,
    regularRate: 2600,
    breakfastRate: null,
    type: "STANDARD",
  };
}

export function getRoomRate(number: string): number {
  return getRoomCatalogEntry(number).regularRate;
}
