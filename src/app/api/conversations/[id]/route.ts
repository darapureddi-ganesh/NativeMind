import { NextRequest, NextResponse } from "next/server";
import { conversations, messages } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/conversations/:id — conversation with its messages
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const conv = conversations.get(id);
  if (!conv) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({
    conversation: conv,
    messages: messages.byConversation(id),
  });
}

// DELETE /api/conversations/:id
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  conversations.remove(id);
  return NextResponse.json({ ok: true });
}
