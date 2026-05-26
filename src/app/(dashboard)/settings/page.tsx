import { DashboardShell } from "@/components/layout/DashboardShell";
import { BackdateArrivalsTool } from "@/components/settings/BackdateArrivalsTool";
import { RelocateGuestTool } from "@/components/settings/RelocateGuestTool";
import { SettingsForm } from "@/components/settings/SettingsForm";
import { getHotelSettings } from "@/lib/settings";
import Link from "next/link";

export default async function SettingsPage() {
  const settings = await getHotelSettings();

  return (
    <DashboardShell title="Settings">
      <p className="mb-6 text-sm text-slate-500">
        Configure hotel branding, tax rate, and receipt footer. Administrator access only.
      </p>
      <SettingsForm settings={settings} />
      <div className="mb-8 rounded-xl border border-slate-200 bg-card p-5 shadow-sm">
        <h3 className="font-semibold text-slate-800">Correct encoded records</h3>
        <p className="mt-2 text-sm text-slate-600">
          Fix guest names, dates, rooms, booking references, and other reservation details when
          front desk staff made a mistake.
        </p>
        <Link
          href="/settings/edit-records"
          className="mt-4 inline-flex rounded-lg bg-room-occupied px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Open Edit Records
        </Link>
      </div>
      <BackdateArrivalsTool />
      <RelocateGuestTool />
    </DashboardShell>
  );
}
