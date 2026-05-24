import { getReceiptData } from "@/lib/receipts";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const folioId = searchParams.get("folioId");

  if (!folioId) {
    return NextResponse.json({ error: "folioId required" }, { status: 400 });
  }

  const receipt = await getReceiptData(folioId);
  if (!receipt) {
    return NextResponse.json({ error: "Receipt not found" }, { status: 404 });
  }

  return NextResponse.json(receipt);
}
