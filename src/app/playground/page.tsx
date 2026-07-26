"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, Button, Select, Textarea, Badge, Spinner } from "@/components/ui";
import { IconZap, IconClock, IconHash, IconTraces, IconPlayground } from "@/components/icons";
import type { OllamaModel } from "@/lib/types";

interface Side {
  model: string;
  output: string;
  streaming: boolean;
  traceId?: string;
  metrics?: { latencyMs: number; totalTokens?: number; tokensPerSecond?: number };
  error?: string;
}

export default function PlaygroundPage() {
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [prompt, setPrompt] = useState("");
  const [system, setSystem] = useState("");
  const [busy, setBusy] = useState(false);
  const [sides, setSides] = useState<[Side, Side]>([
    { model: "", output: "", streaming: false },
    { model: "", output: "", streaming: false },
  ]);

  useEffect(() => {
    (async () => {
      const [mData, sData] = await Promise.all([
        fetch("/api/models").then((r) => r.json()),
        fetch("/api/settings").then((r) => r.json()).catch(() => ({})),
      ]);
      const ms: OllamaModel[] = mData.models ?? [];
      setModels(ms);
      const preferred: string | undefined = sData?.settings?.defaultModel;
      const first =
        preferred && ms.some((m) => m.name === preferred)
          ? preferred
          : (ms[0]?.name ?? "");
      const second = ms.find((m) => m.name !== first)?.name ?? first;
      setSides((prev) => [
        { ...prev[0], model: first },
        { ...prev[1], model: second },
      ]);
    })();
  }, []);

  const setSide = (i: 0 | 1, patch: Partial<Side>) =>
    setSides((prev) => {
      const next: [Side, Side] = [{ ...prev[0] }, { ...prev[1] }];
      next[i] = { ...next[i], ...patch };
      return next;
    });

  const runOne = async (i: 0 | 1, model: string) => {
    setSide(i, { output: "", streaming: true, traceId: undefined, metrics: undefined, error: undefined });
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: prompt }],
          systemPrompt: system || undefined,
          type: "playground",
        }),
      });
      if (!res.ok || !res.body) {
        const e = await res.json().catch(() => ({ error: "failed" }));
        throw new Error(e.error || "failed");
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const obj = JSON.parse(line);
          if (obj.delta) {
            acc += obj.delta;
            setSide(i, { output: acc });
          } else if (obj.done) {
            setSide(i, {
              streaming: false,
              traceId: obj.traceId,
              metrics: obj.metrics,
              error: obj.error,
            });
          }
        }
      }
    } catch (e) {
      setSide(i, { streaming: false, error: (e as Error).message });
    }
  };

  const run = async () => {
    if (!prompt.trim() || busy) return;
    setBusy(true);
    await Promise.all([runOne(0, sides[0].model), runOne(1, sides[1].model)]);
    setBusy(false);
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <IconPlayground width={22} height={22} className="text-primary" /> Playground
        </h1>
        <p className="mt-1 text-sm text-muted">
          Send the same prompt to two models and compare. Both runs are logged as traces.
        </p>
      </div>

      <Card className="mb-6 space-y-3 p-4">
        <Textarea
          rows={2}
          placeholder="Optional system prompt…"
          value={system}
          onChange={(e) => setSystem(e.target.value)}
        />
        <Textarea
          rows={3}
          placeholder="Your prompt…"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
        <div className="flex justify-end">
          <Button onClick={run} disabled={busy || !prompt.trim()}>
            {busy ? <Spinner /> : <IconPlayground width={16} height={16} />}
            Run comparison
          </Button>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {([0, 1] as const).map((i) => {
          const s = sides[i];
          return (
            <Card key={i} className="flex flex-col p-4">
              <Select
                value={s.model}
                onChange={(e) => setSide(i, { model: e.target.value })}
                className="mb-3 w-full"
              >
                {models.map((m) => (
                  <option key={m.name} value={m.name}>
                    {m.name}
                  </option>
                ))}
              </Select>

              <div className="min-h-[8rem] flex-1 whitespace-pre-wrap break-words rounded-lg border border-border bg-panel-2 p-3 text-sm">
                {s.error ? (
                  <span className="text-danger">⚠️ {s.error}</span>
                ) : (
                  <>
                    {s.output || <span className="text-muted-2">Awaiting run…</span>}
                    {s.streaming && (
                      <span className="ml-1 inline-block h-3.5 w-1.5 animate-pulse bg-primary align-middle" />
                    )}
                  </>
                )}
              </div>

              {s.metrics && (
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-2">
                  <span className="inline-flex items-center gap-1">
                    <IconClock width={11} height={11} /> {s.metrics.latencyMs} ms
                  </span>
                  {s.metrics.totalTokens != null && (
                    <span className="inline-flex items-center gap-1">
                      <IconHash width={11} height={11} /> {s.metrics.totalTokens} tok
                    </span>
                  )}
                  {s.metrics.tokensPerSecond != null && (
                    <span className="inline-flex items-center gap-1">
                      <IconZap width={11} height={11} /> {s.metrics.tokensPerSecond} tok/s
                    </span>
                  )}
                  {s.traceId && (
                    <Link
                      href={`/traces/${s.traceId}`}
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      <IconTraces width={11} height={11} /> trace
                    </Link>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
