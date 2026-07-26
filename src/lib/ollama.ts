// Thin client for the local Ollama HTTP API (default http://localhost:11434).
// Docs: https://github.com/ollama/ollama/blob/main/docs/api.md

import type { ChatMessage, OllamaModel, TraceParams } from "./types";

export const OLLAMA_HOST =
  process.env.OLLAMA_HOST?.replace(/\/$/, "") || "http://localhost:11434";

async function api(path: string, init?: RequestInit) {
  const res = await fetch(`${OLLAMA_HOST}${path}`, init);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Ollama ${path} failed: ${res.status} ${res.statusText} ${text}`
    );
  }
  return res;
}

/** Is Ollama reachable? */
export async function ping(): Promise<boolean> {
  try {
    const res = await fetch(`${OLLAMA_HOST}/api/tags`, {
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

interface RawTagModel {
  name: string;
  model: string;
  size: number;
  modified_at: string;
  details?: {
    family?: string;
    parameter_size?: string;
    quantization_level?: string;
  };
}

export async function listModels(): Promise<OllamaModel[]> {
  const res = await api("/api/tags");
  const data = (await res.json()) as { models?: RawTagModel[] };
  return (data.models ?? []).map((m) => ({
    name: m.name,
    model: m.model,
    size: m.size,
    modifiedAt: m.modified_at,
    family: m.details?.family,
    parameterSize: m.details?.parameter_size,
    quantization: m.details?.quantization_level,
  }));
}

export async function deleteModel(name: string): Promise<void> {
  await api("/api/delete", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
}

/** Pull a model, returning the raw NDJSON progress stream from Ollama. */
export async function pullModelStream(name: string): Promise<ReadableStream<Uint8Array>> {
  const res = await api("/api/pull", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, stream: true }),
  });
  if (!res.body) throw new Error("No response body from Ollama pull");
  return res.body;
}

export interface ChatChunk {
  message?: { role: string; content: string };
  done: boolean;
  // final chunk carries metrics (nanoseconds)
  total_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
  eval_duration?: number;
}

/** Start a streaming chat completion. Returns the NDJSON stream from Ollama. */
export async function chatStream(opts: {
  model: string;
  messages: ChatMessage[];
  params?: TraceParams;
}): Promise<ReadableStream<Uint8Array>> {
  const { model, messages, params } = opts;
  const res = await api("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      options: params ?? {},
    }),
  });
  if (!res.body) throw new Error("No response body from Ollama chat");
  return res.body;
}

/** Non-streaming chat — used by the LLM-as-judge evaluator. */
export async function chatOnce(opts: {
  model: string;
  messages: ChatMessage[];
  params?: TraceParams;
}): Promise<string> {
  const { model, messages, params } = opts;
  const res = await api("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages,
      stream: false,
      options: params ?? {},
    }),
  });
  const data = (await res.json()) as { message?: { content?: string } };
  return data.message?.content ?? "";
}
