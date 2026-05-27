import { GuardDesk } from "@/components/guard/GuardDesk";
import { GuardShell } from "@/components/guard/GuardShell";
import { getActiveStays, getTodayReservedArrivals } from "@/lib/check-in-out";

export const dynamic = "force-dynamic";

export default async function GuardPage() {
  const [activeStays, reservedArrivals] = await Promise.all([
    getActiveStays(),
    getTodayReservedArrivals(),
  ]);

  return (
    <GuardShell>
      <GuardDesk activeStays={activeStays} reservedArrivals={reservedArrivals} />
    </GuardShell>
  );
}
