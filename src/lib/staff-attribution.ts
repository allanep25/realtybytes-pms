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

export function getReceiptStaffLines(
  encodedBy: StaffAttribution | null,
  checkedInBy: StaffAttribution | null,
): string[] {
  const encoded = formatStaffAttribution(encodedBy);
  const checkedIn = formatStaffAttribution(checkedInBy);

  if (encoded && checkedIn && encoded === checkedIn) {
    return [`Recorded by: ${encoded}`];
  }

  const lines: string[] = [];
  if (encoded) lines.push(`Encoded by: ${encoded}`);
  if (checkedIn) lines.push(`Checked in by: ${checkedIn}`);
  return lines;
}

export function mapStaffAttribution(
  employee: { name: string; role: EmployeeRole } | null | undefined,
): StaffAttribution | null {
  if (!employee) return null;
  return { name: employee.name, role: employee.role };
}
