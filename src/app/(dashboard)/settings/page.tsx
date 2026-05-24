import { DashboardShell } from "@/components/layout/DashboardShell";
import { SettingsForm } from "@/components/settings/SettingsForm";
import { getHotelSettings } from "@/lib/settings";

export default async function SettingsPage() {
  const settings = await getHotelSettings();

  return (
    <DashboardShell title="Settings">
      <p className="mb-6 text-sm text-slate-500">
        Configure hotel branding, tax rate, and receipt footer. Administrator access only.
      </p>
      <SettingsForm settings={settings} />
    </DashboardShell>
  );
}
