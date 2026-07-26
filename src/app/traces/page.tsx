"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, Badge, Select, Spinner, EmptyState } from "@/components/ui";
import { IconTraces, IconClock, IconZap, IconStar } from "@/components/icons";
import { timeAgo } from "@/lib/cn";

interface TraceRow {
  id: string;
  createdAt: string;
  type: string;
  model: string;
  input: { role: string; content: string }[];
  output: string;
  totalTokens?: number;
  latencyMs: number;
  tokensPerSecond?: number;
  evalCount: number;
  rating: number | null;
  error?: string;
}

export default function TracesPage() {
  const [traces, setTraces] = useState<TraceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [model, setModel] = useState("");

  const load = () => {
    setLoading(true);
    const q = model ? `?model=${encodeURIComponent(model)}` : "";
    fetch(`/api/traces${q}`)
      .then((r) => r.json())
      .then((d) => setTraces(d.traces ?? []))
      .finally(() => setLoading(false));
  };

  useEffect(load, [model]);

  const models = Array.from(new Set(traces.map((t) => t.model)));

  const firstUser = (t: TraceRow) =>
    t.input.find((m) => m.role === "user")?.content ?? "(no prompt)";

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Traces</h1>
          <p className="mt-1 text-sm text-muted">
            Every logged LLM call. Click one to inspect and evaluate it.
          </p>
        </div>
        {models.length > 0 && (
          <Select value={model} onChange={(e) => setModel(e.target.value)}>
            <option value="">All models</option>
            {models.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </Select>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16 text-muted">
          <Spinner className="h-6 w-6" />
        </div>
      ) : traces.length === 0 ? (
        <EmptyState
          icon={<IconTraces width={28} height={28} />}
          title="No traces yet"
          hint="Chat with a model and its calls will appear here automatically."
        />
      ) : (
        <div className="space-y-2">
          {traces.map((t) => (
            <Link key={t.id} href={`/traces/${t.id}`}>
              <Card className="flex items-center gap-4 p-4 transition hover:border-primary/50">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Badge tone="primary">{t.model}</Badge>
                    {t.type === "playground" && <Badge tone="accent">playground</Badge>}
                    {t.error && <Badge tone="danger">error</Badge>}
                    {t.rating != null && (
                      <Badge tone="warning">
                        <IconStar width={11} height={11} /> {t.rating}
                      </Badge>
                    )}
                    {t.evalCount > 0 && <Badge tone="success">{t.evalCount} evals</Badge>}
                  </div>
                  <div className="mt-1.5 truncate text-sm text-fg">{firstUser(t)}</div>
                  <div className="truncate text-xs text-muted">{t.output}</div>
                </div>
                <div className="hidden shrink-0 flex-col items-end gap-1 text-[11px] text-muted-2 sm:flex">
                  <span className="inline-flex items-center gap-1">
                    <IconClock width={11} height={11} /> {t.latencyMs} ms
                  </span>
                  {t.tokensPerSecond != null && (
                    <span className="inline-flex items-center gap-1">
                      <IconZap width={11} height={11} /> {t.tokensPerSecond} tok/s
                    </span>
                  )}
                  <span>{timeAgo(t.createdAt)}</span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
