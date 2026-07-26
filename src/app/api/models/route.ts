import { NextRequest, NextResponse } from "next/server";
import { listModels, deleteModel, pullModelStream, ping } from "@/lib/ollama";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/models — list installed models (and Ollama reachability)
export async function GET() {
  const up = await ping();
  if (!up) {
    return NextResponse.json(
      { ok: false, error: "Ollama is not reachable", models: [] },
      { status: 200 }
    );
  }
  try {
    const models = await listModels();
    return NextResponse.json({ ok: true, models });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message, models: [] },
      { status: 200 }
    );
  }
}

// POST /api/models { name } — pull a model, streaming progress (NDJSON passthrough)
export async function POST(req: NextRequest) {
  const { name } = (await req.json()) as { name?: string };
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  try {
    const stream = await pullModelStream(name);
    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}

// DELETE /api/models { name } — remove a model
export async function DELETE(req: NextRequest) {
  const { name } = (await req.json()) as { name?: string };
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  try {
    await deleteModel(name);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
