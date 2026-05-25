"use client";

import { EMPLOYEE_ROLE_LABELS } from "@/lib/constants";
import type { EmployeeListItem } from "@/lib/employees";
import { cn } from "@/lib/utils";
import type { EmployeeRole } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus } from "lucide-react";
import { ChangePasswordModal } from "@/components/auth/ChangePasswordModal";

type EmployeeManagementProps = {
  employees: EmployeeListItem[];
};

const ROLES: EmployeeRole[] = ["ADMINISTRATOR", "FRONT_DESK", "HOUSEKEEPING"];

export function EmployeeManagement({ employees }: EmployeeManagementProps) {
  const router = useRouter();
  const [showAdd, setShowAdd] = useState(false);
  const [resetTarget, setResetTarget] = useState<EmployeeListItem | null>(null);
  const [form, setForm] = useState({ name: "", role: "FRONT_DESK" as EmployeeRole });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function addEmployee(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to add");
      setShowAdd(false);
      setForm({ name: "", role: "FRONT_DESK" });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(id: string, current: string) {
    const status = current === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    try {
      const res = await fetch(`/api/employees/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Update failed");
      router.refresh();
    } catch {
      setError("Failed to update status");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 rounded-lg bg-room-vacant px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          Add Employee
        </button>
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-room-dirty">
          {error}
        </p>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-100 bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {employees.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                  No employees yet.
                </td>
              </tr>
            ) : (
              employees.map((emp) => (
                <tr key={emp.id} className="border-b border-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{emp.name}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {EMPLOYEE_ROLE_LABELS[emp.role]}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-block rounded-full px-2.5 py-0.5 text-xs font-medium",
                        emp.status === "ACTIVE"
                          ? "bg-green-100 text-green-800"
                          : "bg-slate-100 text-slate-500",
                      )}
                    >
                      {emp.status === "ACTIVE" ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => setResetTarget(emp)}
                        className="text-sm text-room-occupied hover:underline"
                      >
                        Reset password
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleStatus(emp.id, emp.status)}
                        className="text-sm text-slate-600 hover:underline"
                      >
                        {emp.status === "ACTIVE" ? "Deactivate" : "Activate"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form
            onSubmit={addEmployee}
            className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
          >
            <h3 className="text-lg font-semibold text-slate-800">Add Employee</h3>
            <div className="mt-4 space-y-3">
              <label className="block text-sm">
                <span className="text-slate-500">Name</span>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="text-slate-500">Role</span>
                <select
                  value={form.role}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, role: e.target.value as EmployeeRole }))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {EMPLOYEE_ROLE_LABELS[r]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-room-vacant px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {saving ? "Adding…" : "Add"}
              </button>
            </div>
          </form>
        </div>
      )}

      <ChangePasswordModal
        open={resetTarget != null}
        onClose={() => setResetTarget(null)}
        mode="admin"
        employeeId={resetTarget?.id}
        employeeName={resetTarget?.name}
      />
    </div>
  );
}
