import { NextRequest, NextResponse } from "next/server";
import { datasets, datasetItems, newId, nowIso } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/datasets/:id/items { input, expectedOutput? }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!datasets.get(id)) {
    return NextResponse.json({ error: "dataset not found" }, { status: 404 });
  }
  const { input, expectedOutput } = (await req.json()) as {
    input?: string;
    expectedOutput?: string;
  };
  if (!input?.trim()) {
    return NextResponse.json({ error: "input is required" }, { status: 400 });
  }
  const item = datasetItems.insert({
    id: newId(),
    datasetId: id,
    input: input.trim(),
    expectedOutput: expectedOutput?.trim() || undefined,
    createdAt: nowIso(),
  });
  return NextResponse.json({ item });
}

// DELETE /api/datasets/:id/items?itemId=
export async function DELETE(req: NextRequest) {
  const itemId = new URL(req.url).searchParams.get("itemId");
  if (!itemId) return NextResponse.json({ error: "itemId required" }, { status: 400 });
  datasetItems.remove(itemId);
  return NextResponse.json({ ok: true });
}
