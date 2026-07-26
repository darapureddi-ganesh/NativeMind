"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, Button, Badge, Select, Input, Textarea, Spinner } from "@/components/ui";
import { IconStar, IconTrash, IconSparkle, IconGauge } from "@/components/icons";
import { timeAgo } from "@/lib/cn";
import type { Trace, Evaluation, OllamaModel } from "@/lib/types";

export default function TraceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [trace, setTrace] = useState<Trace | null>(null);
  const [evals, setEvals] = useState<Evaluation[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [models, setModels] = useState<OllamaModel[]>([]);
  const [judgeModel, setJudgeModel] = useState("");
  const [criteria, setCriteria] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/traces/${id}`);
    if (res.status === 404) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    const data = await res.json();
    setTrace(data.trace);
    setEvals(data.evaluations ?? []);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
    fetch("/api/models")
      .then((r) => r.json())
      .then((d) => {
        setModels(d.models ?? []);
        if (d.models?.[0]) setJudgeModel(d.models[0].name);
      });
  }, [load]);

  const postEval = async (body: Record<string, unknown>, tag: string) => {
    setBusy(tag);
    try {
      const res = await fetch("/api/evaluations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ traceId: id, ...body }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        alert(e.error || "Evaluation failed");
      }
      await load();
    } finally {
      setBusy(null);
    }
  };

  const rate = (score: number) =>
    postEval({ type: "manual", name: "rating", score, rationale: note || undefined }, "rate");
  const runAuto = () => postEval({ type: "auto" }, "auto");
  const runJudge = () =>
    postEval({ type: "llm_judge", judgeModel, criteria: criteria || undefined }, "judge");

  const deleteEval = async (evalId: string) => {
    await fetch(`/api/evaluations?id=${evalId}`, { method: "DELETE" });
    await load();
  };

  const deleteTrace = async () => {
    if (!confirm("Delete this trace and its evaluations?")) return;
    await fetch(`/api/traces/${id}`, { method: "DELETE" });
    router.push("/traces");
  };

  if (loading)
    return (
      <div className="flex justify-center py-24 text-muted">
        <Spinner className="h-6 w-6" />
      </div>
    );
  if (notFound || !trace)
    return (
      <div className="mx-auto max-w-3xl px-6 py-16 text-center text-muted">
        Trace not found.{" "}
        <button onClick={() => router.push("/traces")} className="text-primary underline">
          Back to traces
        </button>
      </div>
    );

  const currentRating = evals.find((e) => e.type === "manual")?.score ?? null;

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <button
            onClick={() => router.push("/traces")}
            className="text-sm text-muted hover:text-fg"
          >
            ← Traces
          </button>
          <h1 className="mt-1 flex items-center gap-2 text-xl font-semibold">
            <Badge tone="primary">{trace.model}</Badge>
            <span className="text-sm font-normal text-muted">
              {timeAgo(trace.createdAt)}
            </span>
          </h1>
        </div>
        <Button variant="danger" size="sm" onClick={deleteTrace}>
          <IconTrash width={14} height={14} /> Delete
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        {/* Left: conversation */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Meta label="Latency" value={`${trace.latencyMs} ms`} />
            <Meta label="Tokens" value={`${trace.totalTokens ?? "—"}`} />
            <Meta label="Speed" value={trace.tokensPerSecond ? `${trace.tokensPerSecond} tok/s` : "—"} />
            <Meta
              label="Temp"
              value={`${(trace.params?.temperature as number) ?? "—"}`}
            />
          </div>

          {trace.systemPrompt && (
            <Card className="p-4">
              <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">
                System
              </div>
              <div className="whitespace-pre-wrap text-sm text-muted">
                {trace.systemPrompt}
              </div>
            </Card>
          )}

          {trace.input.map((m, i) => (
            <Card key={i} className="p-4">
              <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">
                {m.role}
              </div>
              <div className="prose-chat whitespace-pre-wrap break-words text-sm">
                {m.content}
              </div>
            </Card>
          ))}

          <Card className="border-primary/30 p-4">
            <div className="mb-1 text-xs font-medium uppercase tracking-wide text-primary">
              assistant
            </div>
            <div className="prose-chat whitespace-pre-wrap break-words text-sm">
              {trace.output || "(empty)"}
            </div>
            {trace.error && (
              <div className="mt-2 text-xs text-danger">Error: {trace.error}</div>
            )}
          </Card>
        </div>

        {/* Right: evaluation panel */}
        <div className="space-y-4">
          <Card className="p-4">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-medium">
              <IconStar width={15} height={15} className="text-warning" /> Rate
            </h3>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => rate(n)}
                  disabled={busy === "rate"}
                  className="p-1 transition hover:scale-110"
                  title={`${n} / 5`}
                >
                  <IconStar
                    width={22}
                    height={22}
                    className={
                      currentRating != null && n <= currentRating
                        ? "text-warning"
                        : "text-muted-2"
                    }
                    fill={currentRating != null && n <= currentRating ? "currentColor" : "none"}
                  />
                </button>
              ))}
            </div>
            <Input
              className="mt-3"
              placeholder="Optional note…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </Card>

          <Card className="p-4">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-medium">
              <IconGauge width={15} height={15} className="text-accent" /> Auto metrics
            </h3>
            <p className="mb-3 text-xs text-muted">
              Compute deterministic metrics (length, latency, speed).
            </p>
            <Button variant="ghost" size="sm" onClick={runAuto} disabled={busy === "auto"}>
              {busy === "auto" ? <Spinner /> : <IconGauge width={14} height={14} />}
              Compute
            </Button>
          </Card>

          <Card className="p-4">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-medium">
              <IconSparkle width={15} height={15} className="text-primary" /> LLM-as-judge
            </h3>
            <label className="mb-1 block text-xs text-muted">Judge model</label>
            <Select
              value={judgeModel}
              onChange={(e) => setJudgeModel(e.target.value)}
              className="mb-2 w-full"
            >
              {models.map((m) => (
                <option key={m.name} value={m.name}>
                  {m.name}
                </option>
              ))}
            </Select>
            <Textarea
              rows={2}
              className="mb-2"
              placeholder="Criteria (default: helpfulness, correctness, clarity)"
              value={criteria}
              onChange={(e) => setCriteria(e.target.value)}
            />
            <Button size="sm" onClick={runJudge} disabled={busy === "judge" || !judgeModel}>
              {busy === "judge" ? <Spinner /> : <IconSparkle width={14} height={14} />}
              Run judge
            </Button>
          </Card>

          {evals.length > 0 && (
            <Card className="p-4">
              <h3 className="mb-3 text-sm font-medium">Evaluations</h3>
              <div className="space-y-2">
                {evals.map((e) => (
                  <div
                    key={e.id}
                    className="group flex items-start justify-between gap-2 rounded-lg border border-border bg-panel-2 p-2.5"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge
                          tone={
                            e.type === "manual"
                              ? "warning"
                              : e.type === "llm_judge"
                                ? "primary"
                                : "accent"
                          }
                        >
                          {e.name}
                        </Badge>
                        {e.score != null && (
                          <span className="text-sm font-semibold tabular-nums">
                            {e.score}
                          </span>
                        )}
                      </div>
                      {e.rationale && (
                        <p className="mt-1 text-xs text-muted">{e.rationale}</p>
                      )}
                    </div>
                    <button
                      onClick={() => deleteEval(e.id)}
                      className="text-muted-2 opacity-0 transition group-hover:opacity-100 hover:text-danger"
                    >
                      <IconTrash width={13} height={13} />
                    </button>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-2">{label}</div>
      <div className="mt-0.5 text-sm font-semibold tabular-nums">{value}</div>
    </Card>
  );
}
