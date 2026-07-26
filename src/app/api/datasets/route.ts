import { NextRequest, NextResponse } from "next/server";
import { datasets, datasetItems, experiments, newId, nowIso } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/datasets — list with item + experiment counts
export async function GET() {
  const list = datasets.list().map((d) => ({
    ...d,
    itemCount: datasetItems.byDataset(d.id).length,
    experimentCount: experiments.byDataset(d.id).length,
  }));
  return NextResponse.json({ datasets: list });
}

// POST /api/datasets { name, description? }
export async function POST(req: NextRequest) {
  const { name, description } = (await req.json()) as {
    name?: string;
    description?: string;
  };
  if (!name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  const d = datasets.insert({
    id: newId(),
    name: name.trim(),
    description: description?.trim() || undefined,
    createdAt: nowIso(),
  });
  return NextResponse.json({ dataset: d });
}
