import { DashboardShell } from "@/components/layout/DashboardShell";
import Link from "next/link";

export default function GuestNotFound() {
  return (
    <DashboardShell title="Guest Profile">
      <div className="rounded-xl border border-dashed border-slate-300 p-12 text-center">
        <p className="text-slate-600">Guest not found.</p>
        <Link href="/guests" className="mt-4 inline-block text-room-occupied hover:underline">
          Back to guest list
        </Link>
      </div>
    </DashboardShell>
  );
}
