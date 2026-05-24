import { DashboardShell } from "@/components/layout/DashboardShell";
import { ReceiptPreview } from "@/components/receipts/ReceiptPreview";
import { getReceiptData, getReceiptFolios } from "@/lib/receipts";

type PageProps = {
  searchParams: Promise<{ folio?: string }>;
};

export default async function ReceiptsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const folios = await getReceiptFolios();
  const folioId = params.folio ?? folios[0]?.id;
  const initialReceipt = folioId ? await getReceiptData(folioId) : null;

  return (
    <DashboardShell title="Receipt Printing">
      <ReceiptPreview
        folios={folios}
        initialFolioId={folioId}
        initialReceipt={initialReceipt}
      />
    </DashboardShell>
  );
}
