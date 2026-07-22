import { NextResponse } from "next/server";
import { Partner } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildItemsCsvRows, toCsvString, type ItemCsvLine } from "@/lib/exports";

export const dynamic = "force-dynamic";

// Items master cross-reference: HK SKU, Name, ERPNext Code, Rebel SKU (CSV).
export async function GET() {
  const items = await prisma.item.findMany({
    where: { active: true },
    include: { partnerSkus: { where: { partner: { in: [Partner.HK, Partner.REBEL] } } } },
    orderBy: { name: "asc" },
  });

  const lines: ItemCsvLine[] = items.map((it) => ({
    hkSku: it.partnerSkus.find((p) => p.partner === Partner.HK)?.skuCode ?? "",
    name: it.name,
    erpnextCode: it.erpnextCode ?? "",
    rebelSku: it.partnerSkus.find((p) => p.partner === Partner.REBEL)?.skuCode ?? "",
  }));

  const csv = toCsvString(buildItemsCsvRows(lines));
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="items.csv"`,
    },
  });
}
