"use client";

import { formatTime } from "@/lib/format";
import type { ShiftNoteItem } from "@/lib/shift-notes";
import { useRouter } from "next/navigation";
import { useState } from "react";

type ShiftNotesPanelProps = {
  initialNotes: ShiftNoteItem[];
};

export function ShiftNotesPanel({ initialNotes }: ShiftNotesPanelProps) {
  const router = useRouter();
  const [notes, setNotes] = useState(initialNotes);
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/shift-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save note");
      setNotes((prev) => [data, ...prev].slice(0, 8));
      setContent("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save note");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-card p-4 shadow-sm">
      <h3 className="text-lg font-bold text-slate-800">Shift Handover</h3>
      <p className="mt-1 text-sm text-slate-500">Leave notes for the next front desk shift.</p>

      <form onSubmit={handleSubmit} className="mt-3 space-y-2">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={2}
          placeholder="e.g. Room 22 extended stay, VIP arriving at 3 PM…"
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
        {error && <p className="text-xs text-room-dirty">{error}</p>}
        <button
          type="submit"
          disabled={saving || !content.trim()}
          className="rounded-lg bg-sidebar px-3 py-2 text-sm font-medium text-white hover:bg-sidebar-hover disabled:opacity-50"
        >
          {saving ? "Saving…" : "Add note"}
        </button>
      </form>

      <ul className="mt-4 max-h-48 space-y-2 overflow-y-auto text-sm">
        {notes.length === 0 ? (
          <li className="text-slate-400">No shift notes yet.</li>
        ) : (
          notes.map((note) => (
            <li key={note.id} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
              <p className="text-slate-800">{note.content}</p>
              <p className="mt-1 text-xs text-slate-400">
                {note.authorName} · {formatTime(note.createdAt)}
              </p>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
