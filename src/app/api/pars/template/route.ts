import { NextResponse } from "next/server";
import { buildParTemplateRows } from "@/lib/par";
import { toXlsxBuffer } from "@/lib/exports";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await buildParTemplateRows();
  const buffer = toXlsxBuffer(rows, "Pars");
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="par_template.xlsx"`,
    },
  });
}
