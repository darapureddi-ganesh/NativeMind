import { NextRequest, NextResponse } from "next/server";
import { experiments, experimentResults } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/experiments/:id — experiment with its per-item results
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const experiment = experiments.get(id);
  if (!experiment) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({
    experiment,
    results: experimentResults.byExperiment(id),
  });
}

// DELETE /api/experiments/:id
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  experiments.remove(id);
  return NextResponse.json({ ok: true });
}
