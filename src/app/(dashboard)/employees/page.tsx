import { DashboardShell } from "@/components/layout/DashboardShell";
import { EmployeeManagement } from "@/components/employees/EmployeeManagement";
import { getSession } from "@/lib/auth";
import { getEmployeeById, getEmployees } from "@/lib/employees";
import { isAdministrator } from "@/lib/permissions";
import { redirect } from "next/navigation";

export default async function EmployeesPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const isAdmin = isAdministrator(session.role);
  const employees = isAdmin
    ? await getEmployees()
    : [await getEmployeeById(session.id)];

  return (
    <DashboardShell title={isAdmin ? "Employee Accounts" : "My Account"}>
      <EmployeeManagement employees={employees} isAdmin={isAdmin} />
    </DashboardShell>
  );
}
