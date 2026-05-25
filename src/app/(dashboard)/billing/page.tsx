import { DashboardShell } from "@/components/layout/DashboardShell";
import { BillingWorkspace } from "@/components/billing/BillingWorkspace";
import { getFolioById, getFolioByNumber, getOpenFolios } from "@/lib/billing";
import { ensureOpenStayFolios } from "@/lib/check-in-out";

type PageProps = {
  searchParams: Promise<{ folio?: string }>;
};

export default async function BillingPage({ searchParams }: PageProps) {
  const params = await searchParams;
  await ensureOpenStayFolios();
  const folios = await getOpenFolios();

  const folioParam = params.folio?.trim();
  let initialFolio = null;
  let initialFolioId = folios[0]?.id;

  if (folioParam) {
    initialFolio =
      (await getFolioByNumber(folioParam)) ?? (await getFolioById(folioParam));
    initialFolioId = initialFolio?.id ?? initialFolioId;
  } else if (initialFolioId) {
    initialFolio = await getFolioById(initialFolioId);
  }

  return (
    <DashboardShell title="Billing">
      <BillingWorkspace
        folios={folios}
        initialFolioId={initialFolioId}
        initialFolio={initialFolio}
      />
    </DashboardShell>
  );
}
