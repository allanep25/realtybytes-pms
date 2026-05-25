"use client";

import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { useState } from "react";

type ChangePasswordModalProps = {
  open: boolean;
  onClose: () => void;
  mode: "self" | "admin";
  employeeId?: string;
  employeeName?: string;
  onSuccess?: () => void;
};

export function ChangePasswordModal({
  open,
  onClose,
  mode,
  employeeId,
  employeeName,
  onSuccess,
}: ChangePasswordModalProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!open) return null;

  function resetAndClose() {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setError(null);
    setSuccess(null);
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match");
      return;
    }

    setSaving(true);
    try {
      if (mode === "self") {
        const res = await fetch("/api/auth/change-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ currentPassword, newPassword }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Password change failed");
        setSuccess("Password updated successfully.");
      } else {
        if (!employeeId) throw new Error("Employee not found");
        const res = await fetch(`/api/employees/${employeeId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: newPassword }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Password reset failed");
        setSuccess(`Password updated for ${employeeName ?? "employee"}.`);
      }

      onSuccess?.();
      setTimeout(resetAndClose, 1200);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setSaving(false);
    }
  }

  const fieldClass =
    "mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-room-occupied focus:outline-none focus:ring-1 focus:ring-room-occupied";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-800">
            {mode === "self" ? "Change Password" : "Reset Password"}
          </h3>
          <button
            type="button"
            onClick={resetAndClose}
            className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {mode === "admin" && employeeName && (
          <p className="mt-1 text-sm text-slate-500">Set a new password for {employeeName}</p>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-room-dirty">
              {error}
            </p>
          )}
          {success && (
            <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-room-vacant">
              {success}
            </p>
          )}

          {mode === "self" && (
            <label className="block text-sm">
              <span className="text-slate-500">Current password</span>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className={fieldClass}
              />
            </label>
          )}

          <label className="block text-sm">
            <span className="text-slate-500">New password</span>
            <input
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className={fieldClass}
            />
          </label>

          <label className="block text-sm">
            <span className="text-slate-500">Confirm new password</span>
            <input
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={fieldClass}
            />
          </label>

          <p className="text-xs text-slate-400">Minimum 6 characters</p>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={resetAndClose}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className={cn(
                "rounded-lg px-4 py-2 text-sm font-medium text-white",
                "bg-room-vacant hover:opacity-90 disabled:opacity-50",
              )}
            >
              {saving ? "Saving…" : "Save Password"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
