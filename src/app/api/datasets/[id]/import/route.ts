import { NextRequest, NextResponse } from "next/server";
import { datasets, datasetItems, newId, nowIso } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/datasets/:id/import { items: [{ input, expectedOutput? }] }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!datasets.get(id)) {
    return NextResponse.json({ error: "dataset not found" }, { status: 404 });
  }
  const { items } = (await req.json()) as {
    items?: { input?: string; expectedOutput?: string }[];
  };
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "no items to import" }, { status: 400 });
  }

  let added = 0;
  for (const it of items) {
    const input = it.input?.trim();
    if (!input) continue;
    datasetItems.insert({
      id: newId(),
      datasetId: id,
      input,
      expectedOutput: it.expectedOutput?.trim() || undefined,
      createdAt: nowIso(),
    });
    added++;
  }
  return NextResponse.json({ added });
}
