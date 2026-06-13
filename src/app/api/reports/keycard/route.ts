import { parseKeycardWorkbook, reconcileKeycards } from "@/lib/keycard";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected a file upload" }, { status: 400 });
  }

  const file = form.get("file");
  const from = form.get("from");
  const to = form.get("to");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Attach a keycard report file (.xlsx or .csv)" }, { status: 400 });
  }
  if (typeof from !== "string" || typeof to !== "string") {
    return NextResponse.json({ error: "from and to dates are required" }, { status: 400 });
  }

  try {
    const buffer = await file.arrayBuffer();
    const entries = await parseKeycardWorkbook(buffer);
    if (entries.length === 0) {
      return NextResponse.json(
        { error: "No keycard rows could be read from the file. Check the column headers." },
        { status: 400 },
      );
    }
    const result = await reconcileKeycards(entries, from, to);
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to read keycard report";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
