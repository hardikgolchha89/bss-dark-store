import { NextResponse } from "next/server";
import { buildParTemplateRows } from "@/lib/par";
import { toCsvString } from "@/lib/exports";
import { assertApproved } from "@/lib/current-user";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await assertApproved();
  } catch {
    return NextResponse.json({ error: "Access not approved" }, { status: 403 });
  }
  const rows = await buildParTemplateRows();
  const csv = toCsvString(rows);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="par_template.csv"`,
    },
  });
}
