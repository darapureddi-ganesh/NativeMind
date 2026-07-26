"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card, Badge, Select, Input, Button, Spinner, EmptyState } from "@/components/ui";
import { IconTraces, IconClock, IconZap, IconStar, IconDownload } from "@/components/icons";
import { timeAgo } from "@/lib/cn";
import { download, toCSV } from "@/lib/csv";

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
  const [query, setQuery] = useState("");

  const load = () => {
    setLoading(true);
    const q = model ? `?model=${encodeURIComponent(model)}` : "";
    fetch(`/api/traces${q}`)
      .then((r) => r.json())
      .then((d) => setTraces(d.traces ?? []))
      .finally(() => setLoading(false));
  };

  useEffect(load, [model]);

  const models = useMemo(
    () => Array.from(new Set(traces.map((t) => t.model))),
    [traces]
  );

  const firstUser = (t: TraceRow) =>
    t.input.find((m) => m.role === "user")?.content ?? "(no prompt)";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return traces;
    return traces.filter(
      (t) =>
        firstUser(t).toLowerCase().includes(q) ||
        (t.output || "").toLowerCase().includes(q) ||
        t.model.toLowerCase().includes(q)
    );
  }, [traces, query]);

  const exportCsv = () => {
    const rows = filtered.map((t) => ({
      createdAt: t.createdAt,
      model: t.model,
      type: t.type,
      prompt: firstUser(t),
      output: t.output,
      totalTokens: t.totalTokens ?? "",
      latencyMs: t.latencyMs,
      tokensPerSecond: t.tokensPerSecond ?? "",
      rating: t.rating ?? "",
      evalCount: t.evalCount,
    }));
    download(
      `traces-${new Date().toISOString().slice(0, 10)}.csv`,
      toCSV(rows, [
        "createdAt",
        "model",
        "type",
        "prompt",
        "output",
        "totalTokens",
        "latencyMs",
        "tokensPerSecond",
        "rating",
        "evalCount",
      ]),
      "text/csv"
    );
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Traces</h1>
          <p className="mt-1 text-sm text-muted">
            Every logged LLM call. Click one to inspect and evaluate it.
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={exportCsv}
          disabled={filtered.length === 0}
        >
          <IconDownload width={14} height={14} /> Export CSV
        </Button>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        <Input
          placeholder="Search prompts and responses…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="max-w-xs"
        />
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
        {(query || model) && (
          <span className="self-center text-xs text-muted-2">
            {filtered.length} of {traces.length}
          </span>
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
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<IconTraces width={28} height={28} />}
          title="No matching traces"
          hint="Try a different search term or model filter."
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((t) => (
            <Link key={t.id} href={`/traces/${t.id}`}>
              <Card className="flex items-center gap-4 p-4 transition hover:border-primary/50">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Badge tone="primary">{t.model}</Badge>
                    {t.type === "playground" && <Badge tone="accent">playground</Badge>}
                    {t.type === "experiment" && <Badge tone="accent">experiment</Badge>}
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
