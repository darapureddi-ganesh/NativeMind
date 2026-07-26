import { NextResponse } from "next/server";
import { resetAllData } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/data/reset — wipe all traces, conversations, datasets, experiments
export async function POST() {
  resetAllData();
  return NextResponse.json({ ok: true });
}
