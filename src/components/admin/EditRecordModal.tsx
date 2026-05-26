"use client";

import { EditRecordForm } from "@/components/admin/EditRecordForm";
import { X } from "lucide-react";

type EditRecordModalProps = {
  open: boolean;
  reservationId: string | null;
  onClose: () => void;
};

export function EditRecordModal({ open, reservationId, onClose }: EditRecordModalProps) {
  if (!open || !reservationId) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-xl bg-white shadow-xl">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="font-semibold text-slate-800">Edit record</h3>
            <p className="mt-0.5 text-sm text-slate-500">Administrator — fix guest or stay details</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-5">
          <EditRecordForm reservationId={reservationId} onClose={onClose} />
        </div>
      </div>
    </div>
  );
}
