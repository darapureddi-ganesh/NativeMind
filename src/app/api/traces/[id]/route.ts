import { NextRequest, NextResponse } from "next/server";
import { traces, evaluations } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/traces/:id — single trace with its evaluations
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const trace = traces.get(id);
  if (!trace) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ trace, evaluations: evaluations.byTrace(id) });
}

// DELETE /api/traces/:id — remove trace (cascades evaluations)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  traces.remove(id);
  return NextResponse.json({ ok: true });
}
