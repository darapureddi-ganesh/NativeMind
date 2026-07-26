import { NextResponse } from "next/server";
import { conversations } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/conversations — list conversations
export async function GET() {
  return NextResponse.json({ conversations: conversations.list() });
}
