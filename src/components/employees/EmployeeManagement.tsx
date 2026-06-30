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
  isAdmin: boolean;
};

const ROLES: EmployeeRole[] = ["ADMINISTRATOR", "FRONT_DESK", "HOUSEKEEPING", "SECURITY"];

type FormState = {
  name: string;
  email: string;
  role: EmployeeRole;
  password: string;
};

const EMPTY_FORM: FormState = {
  name: "",
  email: "",
  role: "FRONT_DESK",
  password: "",
};

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

function EmailCell({ email }: { email: string | null }) {
  if (!email) {
    return <span className="text-slate-400">No login — add email in Edit</span>;
  }
  return <span className="text-slate-600">{email}</span>;
}

export function EmployeeManagement({ employees, isAdmin }: EmployeeManagementProps) {
  const router = useRouter();
  const currentUser = useAuth();
  const [showAdd, setShowAdd] = useState(false);
  const [editTarget, setEditTarget] = useState<EmployeeListItem | null>(null);
  const [resetTarget, setResetTarget] = useState<EmployeeListItem | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openAdd() {
    setForm(EMPTY_FORM);
    setShowAdd(true);
  }

  function openEdit(emp: EmployeeListItem) {
    setForm({
      name: emp.name,
      email: emp.email ?? "",
      role: emp.role,
      password: "",
    });
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
      setForm(EMPTY_FORM);
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
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          role: form.role,
        }),
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

  const showFormModal = isAdmin && (showAdd || editTarget != null);
  const columnCount = isAdmin ? 5 : 4;

  return (
    <div className="space-y-4">
      {!isAdmin && (
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Sign in on any device with your email and password. To change your password, use{" "}
          <span className="font-medium">Change password</span> in the profile menu at the top
          right.
        </p>
      )}

      {isAdmin && (
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Staff log in with their <span className="font-medium">email</span> (not their display
          name). Set email and password when adding an employee, or use Edit + Reset password for
          existing staff.
        </p>
      )}

      {isAdmin && (
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
      )}

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-room-dirty">
          {error}
        </p>
      )}

      <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-card shadow-sm md:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Login email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                {isAdmin && <th className="px-4 py-3">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {employees.length === 0 ? (
                <tr>
                  <td colSpan={columnCount} className="px-4 py-8 text-center text-slate-400">
                    No employees yet.
                  </td>
                </tr>
              ) : (
                employees.map((emp) => (
                  <tr key={emp.id} className="border-b border-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">{emp.name}</td>
                    <td className="px-4 py-3">
                      <EmailCell email={emp.email} />
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {EMPLOYEE_ROLE_LABELS[emp.role]}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={emp.status} />
                    </td>
                    {isAdmin && (
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
                    )}
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
                  <p className="mt-0.5 text-sm">
                    <EmailCell email={emp.email} />
                  </p>
                  <p className="mt-0.5 text-sm text-slate-600">
                    {EMPLOYEE_ROLE_LABELS[emp.role]}
                  </p>
                </div>
                <StatusBadge status={emp.status} />
              </div>
              {isAdmin && (
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
              )}
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
            <p className="mt-1 text-sm text-slate-500">
              {editTarget
                ? "Update login email if needed. Use Reset password to change their password."
                : "Email and password are used to sign in on tablets and computers."}
            </p>
            <div className="mt-4 space-y-3">
              <label className="block text-sm">
                <span className="text-slate-500">Display name</span>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="text-slate-500">Login email</span>
                <input
                  type="email"
                  required
                  autoComplete="off"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                  placeholder="staff@realtybytes.test"
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
              {!editTarget && (
                <label className="block text-sm">
                  <span className="text-slate-500">Initial password</span>
                  <input
                    type="password"
                    required
                    minLength={6}
                    autoComplete="new-password"
                    value={form.password}
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                    placeholder="At least 6 characters"
                  />
                </label>
              )}
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

      {isAdmin && (
        <ChangePasswordModal
          open={resetTarget != null}
          onClose={() => setResetTarget(null)}
          mode="admin"
          employeeId={resetTarget?.id}
          employeeName={resetTarget?.name}
        />
      )}
    </div>
  );
}
