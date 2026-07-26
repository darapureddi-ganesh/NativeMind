import { NextRequest, NextResponse } from "next/server";
import { getSettings, saveSettings, resolveOllamaHost } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/settings — current settings + effective host
export async function GET() {
  return NextResponse.json({
    settings: getSettings(),
    effectiveHost: resolveOllamaHost(),
    envHost: process.env.OLLAMA_HOST ?? null,
  });
}

// POST /api/settings { ollamaHost?, defaultModel? }
export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    ollamaHost?: string;
    defaultModel?: string;
  };
  const settings = saveSettings({
    ollamaHost: body.ollamaHost,
    defaultModel: body.defaultModel,
  });
  return NextResponse.json({ settings, effectiveHost: resolveOllamaHost() });
}
