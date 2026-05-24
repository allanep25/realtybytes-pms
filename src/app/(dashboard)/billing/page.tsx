import { DashboardShell } from "@/components/layout/DashboardShell";
import { BillingWorkspace } from "@/components/billing/BillingWorkspace";
import { getFolioById, getOpenFolios } from "@/lib/billing";

type PageProps = {
  searchParams: Promise<{ folio?: string }>;
};

export default async function BillingPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const folios = await getOpenFolios();
  const folioId = params.folio ?? folios[0]?.id;
  const initialFolio = folioId ? await getFolioById(folioId) : null;

  return (
    <DashboardShell title="Billing">
      <BillingWorkspace
        folios={folios}
        initialFolioId={folioId}
        initialFolio={initialFolio}
      />
    </DashboardShell>
  );
}
