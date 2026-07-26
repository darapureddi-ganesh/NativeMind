import { NextRequest, NextResponse } from "next/server";
import { traces, evaluations } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/traces?model=&type=&limit= — list traces with eval summaries
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const model = searchParams.get("model") || undefined;
  const type = searchParams.get("type") || undefined;
  const limit = Number(searchParams.get("limit")) || undefined;

  const rows = traces.list({ model, type, limit });
  const withEvals = rows.map((t) => {
    const evs = evaluations.byTrace(t.id);
    return {
      ...t,
      evalCount: evs.length,
      // preview of the most recent manual rating, if any
      rating: evs.find((e) => e.type === "manual")?.score ?? null,
    };
  });
  return NextResponse.json({ traces: withEvals });
}
