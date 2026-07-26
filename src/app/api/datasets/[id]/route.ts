import { NextRequest, NextResponse } from "next/server";
import { datasets, datasetItems, experiments } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/datasets/:id — dataset with items and experiments
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const dataset = datasets.get(id);
  if (!dataset) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({
    dataset,
    items: datasetItems.byDataset(id),
    experiments: experiments.byDataset(id),
  });
}

// DELETE /api/datasets/:id
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  datasets.remove(id);
  return NextResponse.json({ ok: true });
}
