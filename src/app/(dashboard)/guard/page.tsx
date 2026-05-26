import { GuardDesk } from "@/components/guard/GuardDesk";
import { GuardShell } from "@/components/guard/GuardShell";
import { getActiveStays } from "@/lib/check-in-out";

export const dynamic = "force-dynamic";

export default async function GuardPage() {
  const activeStays = await getActiveStays();

  return (
    <GuardShell>
      <GuardDesk activeStays={activeStays} />
    </GuardShell>
  );
}
