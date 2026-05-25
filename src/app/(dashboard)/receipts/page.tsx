import { DashboardShell } from "@/components/layout/DashboardShell";
import { ReceiptPreview } from "@/components/receipts/ReceiptPreview";
import { getFolioById, getFolioByNumber } from "@/lib/billing";
import { ensureOpenStayFolios } from "@/lib/check-in-out";
import { getReceiptData, getReceiptFolios } from "@/lib/receipts";

type PageProps = {
  searchParams: Promise<{ folio?: string }>;
};

export default async function ReceiptsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  await ensureOpenStayFolios();
  const folios = await getReceiptFolios();

  const folioParam = params.folio?.trim();
  let initialFolioId = folios[0]?.id;

  if (folioParam) {
    const fromList = folios.find((f) => f.id === folioParam || f.folioNumber === folioParam);
    if (fromList) {
      initialFolioId = fromList.id;
    } else {
      const resolved =
        (await getFolioByNumber(folioParam)) ?? (await getFolioById(folioParam));
      initialFolioId = resolved?.id ?? initialFolioId;
    }
  }

  const initialReceipt = initialFolioId ? await getReceiptData(initialFolioId) : null;

  return (
    <DashboardShell title="Receipt Printing">
      <ReceiptPreview
        folios={folios}
        initialFolioId={initialFolioId}
        initialReceipt={initialReceipt}
      />
    </DashboardShell>
  );
}
