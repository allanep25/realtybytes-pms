import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  BedDouble,
  CalendarDays,
  ClipboardList,
  CreditCard,
  LayoutDashboard,
  LogIn,
  Printer,
  Settings,
  Sparkles,
  UserCircle,
  Users,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Room Management", href: "/rooms", icon: BedDouble },
  { label: "Reservation Calendar", href: "/calendar", icon: CalendarDays },
  { label: "Check-In / Check-Out", href: "/check-in", icon: LogIn },
  { label: "Guest Profiles", href: "/guests", icon: UserCircle },
  { label: "Billing", href: "/billing", icon: CreditCard },
  { label: "Reports", href: "/reports", icon: BarChart3 },
  { label: "Employee Accounts", href: "/employees", icon: Users },
  { label: "Housekeeping", href: "/housekeeping", icon: Sparkles },
  { label: "Receipt Printing", href: "/receipts", icon: Printer },
  { label: "Settings", href: "/settings", icon: Settings },
];

export const ROOM_STATUS_COLORS = {
  OCCUPIED: "bg-room-occupied text-white",
  VACANT: "bg-room-vacant text-white",
  RESERVED: "bg-room-reserved text-slate-900",
  DIRTY: "bg-room-dirty text-white",
  OUT_OF_ORDER: "bg-room-dirty text-white",
} as const;

export const HOTEL_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "Amar Residences";

export const ROOM_STATUS_LABELS: Record<string, string> = {
  VACANT: "Vacant",
  OCCUPIED: "Occupied",
  RESERVED: "Reserved",
  DIRTY: "Dirty",
  OUT_OF_ORDER: "Out of Order",
};

export const ROOM_TYPE_LABELS: Record<string, string> = {
  STANDARD: "Standard",
  DELUXE: "Deluxe",
  SUITE: "Suite",
};

export const RESERVATION_STATUS_LABELS: Record<string, string> = {
  RESERVED: "Reserved",
  CHECKED_IN: "Checked In",
  CHECKED_OUT: "Checked Out",
  CANCELLED: "Cancelled",
  NO_SHOW: "No Show",
};

export const HOUSEKEEPING_STATUS_LABELS: Record<string, string> = {
  CLEAN: "Clean",
  DIRTY: "Dirty",
  CLEANING: "Cleaning",
  OUT_OF_ORDER: "Out of Order",
};

export const EMPLOYEE_ROLE_LABELS: Record<string, string> = {
  ADMINISTRATOR: "Administrator",
  FRONT_DESK: "Front Desk",
  HOUSEKEEPING: "Housekeeping",
};

export const PAYMENT_METHOD_OPTIONS = [
  { value: "CASH", label: "Cash" },
  { value: "GCASH", label: "GCash" },
  { value: "CARD", label: "Credit / Debit Card" },
  { value: "BANK_TRANSFER", label: "Bank Transfer" },
] as const;
