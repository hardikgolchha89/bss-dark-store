import { NextRequest, NextResponse } from "next/server";
import { Partner } from "@prisma/client";
import {
  buildConsolidatedExport,
  buildErpExport,
  buildErpZip,
  buildPOExport,
  buildPrimePoZip,
  type ExportFile,
} from "@/lib/run-engine";
import { buildMaterialRequestExport } from "@/lib/procurement";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const type = req.nextUrl.searchParams.get("type") ?? "";

  let file: ExportFile;
  try {
    switch (type) {
      case "po_hk":
        file = await buildPOExport(id, Partner.HK);
        break;
      case "po_cz":
        file = await buildPOExport(id, Partner.CZ);
        break;
      case "po_rebel":
        file = await buildPOExport(id, Partner.REBEL);
        break;
      case "erp":
        file = await buildErpExport(id);
        break;
      case "po_zip":
        file = await buildPrimePoZip(id);
        break;
      case "erp_zip":
        file = await buildErpZip(id);
        break;
      case "consolidated":
        file = await buildConsolidatedExport(id);
        break;
      case "mr": {
        const sourceId = req.nextUrl.searchParams.get("source") ?? "";
        if (!sourceId) return NextResponse.json({ error: "Missing source" }, { status: 400 });
        file = await buildMaterialRequestExport(id, sourceId);
        break;
      }
      default:
        return NextResponse.json({ error: `Unknown export type: ${type}` }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }

  return new NextResponse(new Uint8Array(file.buffer), {
    headers: {
      "Content-Type": file.contentType,
      "Content-Disposition": `attachment; filename="${file.filename}"`,
    },
  });
}
