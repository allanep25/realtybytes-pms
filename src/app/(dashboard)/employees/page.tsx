import { DashboardShell } from "@/components/layout/DashboardShell";
import { EmployeeManagement } from "@/components/employees/EmployeeManagement";
import { getEmployees } from "@/lib/employees";

export default async function EmployeesPage() {
  const employees = await getEmployees();

  return (
    <DashboardShell title="Employee Accounts">
      <EmployeeManagement employees={employees} />
    </DashboardShell>
  );
}
