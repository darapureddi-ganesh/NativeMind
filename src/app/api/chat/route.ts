import { NextRequest, NextResponse } from "next/server";
import { chatStream, ping } from "@/lib/ollama";
import { traces, conversations, messages, newId, nowIso } from "@/lib/store";
import type { ChatMessage, TraceParams, Trace } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ChatBody {
  model: string;
  messages: ChatMessage[]; // prior turns (user/assistant), excluding system
  systemPrompt?: string;
  params?: TraceParams;
  conversationId?: string; // if set, persist to that conversation
  type?: "chat" | "playground";
}

// POST /api/chat — streaming chat completion + trace logging.
// Response is NDJSON: {"delta": "..."} lines, then a final
// {"done": true, "traceId": "...", "metrics": {...}} line.
export async function POST(req: NextRequest) {
  if (!(await ping())) {
    return NextResponse.json(
      { error: "Ollama is not reachable at the configured host." },
      { status: 502 }
    );
  }

  const body = (await req.json()) as ChatBody;
  const { model, params = {}, systemPrompt, conversationId } = body;
  const type = body.type ?? "chat";
  if (!model || !Array.isArray(body.messages)) {
    return NextResponse.json(
      { error: "model and messages are required" },
      { status: 400 }
    );
  }

  const fullMessages: ChatMessage[] = systemPrompt
    ? [{ role: "system", content: systemPrompt }, ...body.messages]
    : body.messages;

  const started = Date.now();
  let ollamaStream: ReadableStream<Uint8Array>;
  try {
    ollamaStream = await chatStream({ model, messages: fullMessages, params });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = ollamaStream.getReader();
      let buffer = "";
      let assistant = "";
      let promptTokens: number | undefined;
      let completionTokens: number | undefined;
      let evalDurationNs: number | undefined;
      let hadError: string | undefined;

      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            let chunk: {
              message?: { content?: string };
              done?: boolean;
              error?: string;
              prompt_eval_count?: number;
              eval_count?: number;
              eval_duration?: number;
            };
            try {
              chunk = JSON.parse(trimmed);
            } catch {
              continue;
            }
            if (chunk.error) {
              hadError = chunk.error;
              continue;
            }
            const delta = chunk.message?.content ?? "";
            if (delta) {
              assistant += delta;
              send({ delta });
            }
            if (chunk.done) {
              promptTokens = chunk.prompt_eval_count;
              completionTokens = chunk.eval_count;
              evalDurationNs = chunk.eval_duration;
            }
          }
        }
      } catch (e) {
        hadError = (e as Error).message;
      }

      const latencyMs = Date.now() - started;
      const totalTokens =
        (promptTokens ?? 0) + (completionTokens ?? 0) || undefined;
      const tokensPerSecond =
        completionTokens && evalDurationNs
          ? Number((completionTokens / (evalDurationNs / 1e9)).toFixed(1))
          : undefined;

      // Persist the trace.
      const trace: Trace = {
        id: newId(),
        createdAt: nowIso(),
        type,
        model,
        systemPrompt,
        input: body.messages,
        output: assistant,
        params,
        promptTokens,
        completionTokens,
        totalTokens,
        latencyMs,
        tokensPerSecond,
        conversationId,
        error: hadError,
      };
      try {
        traces.insert(trace);

        // Persist conversation + messages when this is a tracked chat.
        if (conversationId) {
          const now = nowIso();
          const existing = conversations.get(conversationId);
          if (!existing) {
            const firstUser =
              body.messages.find((m) => m.role === "user")?.content ?? "New chat";
            conversations.upsert({
              id: conversationId,
              title: firstUser.slice(0, 60),
              model,
              systemPrompt,
              createdAt: now,
              updatedAt: now,
            });
          } else {
            conversations.upsert({ ...existing, model, updatedAt: now });
          }
          const lastUser = [...body.messages].reverse().find((m) => m.role === "user");
          if (lastUser) {
            messages.insert({
              id: newId(),
              conversationId,
              role: "user",
              content: lastUser.content,
              createdAt: now,
            });
          }
          messages.insert({
            id: newId(),
            conversationId,
            role: "assistant",
            content: assistant,
            traceId: trace.id,
            createdAt: nowIso(),
          });
        }
      } catch {
        // storage failure shouldn't break the stream to the client
      }

      send({
        done: true,
        traceId: trace.id,
        error: hadError,
        metrics: {
          latencyMs,
          promptTokens,
          completionTokens,
          totalTokens,
          tokensPerSecond,
        },
      });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
}
