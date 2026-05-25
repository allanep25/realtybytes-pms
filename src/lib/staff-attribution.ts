import { EMPLOYEE_ROLE_LABELS } from "@/lib/constants";
import type { EmployeeRole } from "@prisma/client";

export type StaffAttribution = {
  name: string;
  role: EmployeeRole;
};

export function formatStaffAttribution(staff: StaffAttribution | null | undefined): string | null {
  if (!staff) return null;
  const roleLabel = EMPLOYEE_ROLE_LABELS[staff.role] ?? staff.role;
  return `${staff.name} · ${roleLabel}`;
}

export function mapStaffAttribution(
  employee: { name: string; role: EmployeeRole } | null | undefined,
): StaffAttribution | null {
  if (!employee) return null;
  return { name: employee.name, role: employee.role };
}

/** One-line staff trail for reports and summaries. */
export function formatStaffTrail(
  encodedBy: StaffAttribution | null,
  checkedInBy: StaffAttribution | null,
  checkedOutBy: StaffAttribution | null = null,
): string | null {
  const encoded = formatStaffAttribution(encodedBy);
  const checkedIn = formatStaffAttribution(checkedInBy);
  const checkedOut = formatStaffAttribution(checkedOutBy);

  const parts: string[] = [];

  if (encoded && checkedIn && encoded === checkedIn) {
    parts.push(`Recorded by ${encoded}`);
  } else {
    if (encoded) parts.push(`Encoded by ${encoded}`);
    if (checkedIn) parts.push(`Checked in by ${checkedIn}`);
  }

  if (checkedOut) parts.push(`Checked out by ${checkedOut}`);

  return parts.length > 0 ? parts.join(" · ") : null;
}

export function getReceiptStaffLines(
  encodedBy: StaffAttribution | null,
  checkedInBy: StaffAttribution | null,
  checkedOutBy: StaffAttribution | null = null,
): string[] {
  const encoded = formatStaffAttribution(encodedBy);
  const checkedIn = formatStaffAttribution(checkedInBy);
  const checkedOut = formatStaffAttribution(checkedOutBy);

  const lines: string[] = [];

  if (encoded && checkedIn && encoded === checkedIn) {
    lines.push(`Recorded by: ${encoded}`);
  } else {
    if (encoded) lines.push(`Encoded by: ${encoded}`);
    if (checkedIn) lines.push(`Checked in by: ${checkedIn}`);
  }

  if (checkedOut) lines.push(`Checked out by: ${checkedOut}`);

  return lines;
}
