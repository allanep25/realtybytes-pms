"use client";

import { ChangePasswordModal } from "@/components/auth/ChangePasswordModal";
import { useAuth } from "@/components/auth/AuthProvider";
import { EMPLOYEE_ROLE_LABELS } from "@/lib/constants";
import type { EmployeeListItem } from "@/lib/employees";
import { cn } from "@/lib/utils";
import type { EmployeeRole } from "@prisma/client";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type EmployeeManagementProps = {
  employees: EmployeeListItem[];
};

const ROLES: EmployeeRole[] = ["ADMINISTRATOR", "FRONT_DESK", "HOUSEKEEPING"];

type FormState = { name: string; role: EmployeeRole };

function EmployeeActions({
  emp,
  isSelf,
  onEdit,
  onResetPassword,
  onToggleStatus,
  onRemove,
}: {
  emp: EmployeeListItem;
  isSelf: boolean;
  onEdit: () => void;
  onResetPassword: () => void;
  onToggleStatus: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1">
      <button
        type="button"
        onClick={onEdit}
        className="text-sm text-room-occupied hover:underline"
      >
        Edit
      </button>
      <button
        type="button"
        onClick={onResetPassword}
        className="text-sm text-room-occupied hover:underline"
      >
        Reset password
      </button>
      <button
        type="button"
        onClick={onToggleStatus}
        className="text-sm text-slate-600 hover:underline"
      >
        {emp.status === "ACTIVE" ? "Deactivate" : "Activate"}
      </button>
      {!isSelf && (
        <button
          type="button"
          onClick={onRemove}
          className="text-sm text-room-dirty hover:underline"
        >
          Remove
        </button>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: EmployeeListItem["status"] }) {
  return (
    <span
      className={cn(
        "inline-block rounded-full px-2.5 py-0.5 text-xs font-medium",
        status === "ACTIVE" ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-500",
      )}
    >
      {status === "ACTIVE" ? "Active" : "Inactive"}
    </span>
  );
}

export function EmployeeManagement({ employees }: EmployeeManagementProps) {
  const router = useRouter();
  const currentUser = useAuth();
  const [showAdd, setShowAdd] = useState(false);
  const [editTarget, setEditTarget] = useState<EmployeeListItem | null>(null);
  const [resetTarget, setResetTarget] = useState<EmployeeListItem | null>(null);
  const [form, setForm] = useState<FormState>({ name: "", role: "FRONT_DESK" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openAdd() {
    setForm({ name: "", role: "FRONT_DESK" });
    setShowAdd(true);
  }

  function openEdit(emp: EmployeeListItem) {
    setForm({ name: emp.name, role: emp.role });
    setEditTarget(emp);
  }

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

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editTarget) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/employees/${editTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to update");
      setEditTarget(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(id: string, current: string) {
    const status = current === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    setError(null);
    try {
      const res = await fetch(`/api/employees/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Update failed");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update status");
    }
  }

  async function removeEmployee(emp: EmployeeListItem) {
    const confirmed = window.confirm(
      `Remove ${emp.name}? This permanently deletes their account and cannot be undone.`,
    );
    if (!confirmed) return;

    setError(null);
    try {
      const res = await fetch(`/api/employees/${emp.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Remove failed");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to remove employee");
    }
  }

  const showFormModal = showAdd || editTarget != null;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={openAdd}
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

      <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-card shadow-sm md:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
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
                      <StatusBadge status={emp.status} />
                    </td>
                    <td className="px-4 py-3">
                      <EmployeeActions
                        emp={emp}
                        isSelf={emp.id === currentUser.id}
                        onEdit={() => openEdit(emp)}
                        onResetPassword={() => setResetTarget(emp)}
                        onToggleStatus={() => toggleStatus(emp.id, emp.status)}
                        onRemove={() => removeEmployee(emp)}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-3 md:hidden">
        {employees.length === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-card px-4 py-8 text-center text-sm text-slate-400">
            No employees yet.
          </p>
        ) : (
          employees.map((emp) => (
            <article
              key={emp.id}
              className="rounded-xl border border-slate-200 bg-card p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-medium text-slate-800">{emp.name}</h3>
                  <p className="mt-0.5 text-sm text-slate-600">
                    {EMPLOYEE_ROLE_LABELS[emp.role]}
                  </p>
                </div>
                <StatusBadge status={emp.status} />
              </div>
              <div className="mt-3 border-t border-slate-100 pt-3">
                <EmployeeActions
                  emp={emp}
                  isSelf={emp.id === currentUser.id}
                  onEdit={() => openEdit(emp)}
                  onResetPassword={() => setResetTarget(emp)}
                  onToggleStatus={() => toggleStatus(emp.id, emp.status)}
                  onRemove={() => removeEmployee(emp)}
                />
              </div>
            </article>
          ))
        )}
      </div>

      {showFormModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <form
            onSubmit={editTarget ? saveEdit : addEmployee}
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-6 shadow-xl"
          >
            <h3 className="text-lg font-semibold text-slate-800">
              {editTarget ? "Edit Employee" : "Add Employee"}
            </h3>
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
                onClick={() => {
                  setShowAdd(false);
                  setEditTarget(null);
                }}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-room-vacant px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {saving ? "Saving…" : editTarget ? "Save" : "Add"}
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
