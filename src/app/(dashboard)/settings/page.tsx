import { DashboardShell } from "@/components/layout/DashboardShell";
import { SettingsForm } from "@/components/settings/SettingsForm";
import { getHotelSettings } from "@/lib/settings";

export default async function SettingsPage() {
  const settings = await getHotelSettings();

  return (
    <DashboardShell title="Property Profile">
      <p className="mb-6 text-sm text-slate-500">
        Customize your property's branding, logo, contact information, and business settings.
        Changes are applied throughout the system.
      </p>
      <SettingsForm settings={settings} />
    </DashboardShell>
  );
}
