import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/** Create FolioPayment rows for folios paid before payment tracking was added. */
async function main() {
  const folios = await prisma.folio.findMany({
    where: {
      paid: { gt: 0 },
      payments: { none: {} },
      reservation: { bookingType: "GUEST" },
    },
    select: {
      id: true,
      paid: true,
      paymentMethod: true,
      paidAt: true,
      updatedAt: true,
    },
  });

  if (folios.length === 0) {
    console.log("No folio payments to backfill.");
    return;
  }

  let created = 0;
  for (const folio of folios) {
    await prisma.folioPayment.create({
      data: {
        folioId: folio.id,
        amount: folio.paid,
        method: folio.paymentMethod ?? "CASH",
        paidAt: folio.paidAt ?? folio.updatedAt,
      },
    });
    created += 1;
  }

  console.log(`Backfilled ${created} folio payment record(s).`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
