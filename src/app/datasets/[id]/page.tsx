"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Card,
  Button,
  Input,
  Textarea,
  Select,
  Badge,
  Spinner,
  EmptyState,
} from "@/components/ui";
import {
  IconDataset,
  IconPlus,
  IconTrash,
  IconRun,
  IconSparkle,
  IconTraces,
  IconClock,
  IconUpload,
  IconDownload,
  IconPlayground,
} from "@/components/icons";
import { timeAgo } from "@/lib/cn";
import { parseItems, toCSV, download } from "@/lib/csv";
import { ComparisonView, type CompareRun } from "@/components/comparison-view";
import type {
  Dataset,
  DatasetItem,
  Experiment,
  ExperimentResult,
  OllamaModel,
} from "@/lib/types";

export default function DatasetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [items, setItems] = useState<DatasetItem[]>([]);
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // add-item form
  const [input, setInput] = useState("");
  const [expected, setExpected] = useState("");

  // import
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("");
  const [importing, setImporting] = useState(false);

  // run form
  const [model, setModel] = useState("");
  const [system, setSystem] = useState("");
  const [judge, setJudge] = useState(true);
  const [criteria, setCriteria] = useState("");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ completed: number; total: number } | null>(
    null
  );

  // results view
  const [results, setResults] = useState<ExperimentResult[]>([]);
  const [activeExp, setActiveExp] = useState<Experiment | null>(null);

  // compare
  const [compareModels, setCompareModels] = useState<string[]>([]);
  const [comparing, setComparing] = useState(false);
  const [compareProgress, setCompareProgress] = useState<{
    model: string;
    completed: number;
    total: number;
    idx: number;
    count: number;
  } | null>(null);
  const [compareRuns, setCompareRuns] = useState<CompareRun[]>([]);

  const load = useCallback(async () => {
    const res = await fetch(`/api/datasets/${id}`);
    if (res.status === 404) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    const data = await res.json();
    setDataset(data.dataset);
    setItems(data.items ?? []);
    setExperiments(data.experiments ?? []);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
    fetch("/api/models")
      .then((r) => r.json())
      .then((d) => {
        setModels(d.models ?? []);
        if (d.models?.[0]) setModel(d.models[0].name);
      });
  }, [load]);

  const addItem = async () => {
    if (!input.trim()) return;
    await fetch(`/api/datasets/${id}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input, expectedOutput: expected }),
    });
    setInput("");
    setExpected("");
    load();
  };

  const deleteItem = async (itemId: string) => {
    await fetch(`/api/datasets/${id}/items?itemId=${itemId}`, { method: "DELETE" });
    load();
  };

  const runImport = async () => {
    const parsed = parseItems(importText);
    if (parsed.length === 0) {
      alert("Couldn't find any prompts. Paste JSON or CSV with an 'input' column.");
      return;
    }
    setImporting(true);
    try {
      const res = await fetch(`/api/datasets/${id}/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: parsed }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Import failed");
        return;
      }
      setImportText("");
      setShowImport(false);
      await load();
      alert(`Imported ${data.added} prompt${data.added === 1 ? "" : "s"}.`);
    } finally {
      setImporting(false);
    }
  };

  const onImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImportText(String(reader.result ?? ""));
    reader.readAsText(file);
  };

  const exportItems = (format: "csv" | "json") => {
    if (format === "json") {
      download(
        `${dataset?.name || "dataset"}.json`,
        JSON.stringify(
          items.map((i) => ({ input: i.input, expectedOutput: i.expectedOutput })),
          null,
          2
        ),
        "application/json"
      );
    } else {
      download(
        `${dataset?.name || "dataset"}.csv`,
        toCSV(items as unknown as Record<string, unknown>[], ["input", "expectedOutput"]),
        "text/csv"
      );
    }
  };

  const exportResults = (format: "csv" | "json") => {
    if (results.length === 0) return;
    const rows = results.map((r) => ({
      input: r.input,
      output: r.output,
      latencyMs: r.latencyMs,
      totalTokens: r.totalTokens ?? "",
      judgeScore: r.judgeScore ?? "",
      judgeRationale: r.judgeRationale ?? "",
    }));
    const stamp = new Date().toISOString().slice(0, 10);
    if (format === "json") {
      download(`results-${stamp}.json`, JSON.stringify(rows, null, 2), "application/json");
    } else {
      download(
        `results-${stamp}.csv`,
        toCSV(rows, [
          "input",
          "output",
          "latencyMs",
          "totalTokens",
          "judgeScore",
          "judgeRationale",
        ]),
        "text/csv"
      );
    }
  };

  const run = async () => {
    if (!model || items.length === 0 || running) return;
    setRunning(true);
    setResults([]);
    setActiveExp(null);
    setProgress({ completed: 0, total: items.length });
    try {
      const res = await fetch("/api/experiments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          datasetId: id,
          model,
          systemPrompt: system || undefined,
          judge: { enabled: judge, criteria: criteria || undefined },
        }),
      });
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: "Run failed" }));
        alert(err.error || "Run failed");
        return;
      }
      // Provisional header so results render as they stream in.
      setActiveExp({
        id: "pending",
        datasetId: id,
        datasetName: dataset?.name ?? "",
        model,
        systemPrompt: system || undefined,
        judgeModel: judge ? model : undefined,
        createdAt: new Date().toISOString(),
        itemCount: items.length,
        avgLatencyMs: 0,
        avgJudgeScore: null,
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const msg = JSON.parse(line);
          if (msg.type === "start") {
            setProgress({ completed: 0, total: msg.total });
          } else if (msg.type === "item") {
            setResults((prev) => [...prev, msg.result]);
            setProgress({ completed: msg.completed, total: items.length });
          } else if (msg.type === "done") {
            setActiveExp(msg.experiment);
          }
        }
      }
      await load();
    } finally {
      setRunning(false);
      setProgress(null);
    }
  };

  // Run one model over the dataset, streaming; returns its experiment + results.
  const runModelStream = async (
    m: string,
    onProgress: (completed: number, total: number) => void
  ): Promise<CompareRun> => {
    const res = await fetch("/api/experiments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        datasetId: id,
        model: m,
        systemPrompt: system || undefined,
        judge: { enabled: judge, criteria: criteria || undefined },
      }),
    });
    if (!res.ok || !res.body) {
      const err = await res.json().catch(() => ({ error: "Run failed" }));
      throw new Error(err.error || "Run failed");
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    const collected: ExperimentResult[] = [];
    let experiment: Experiment | null = null;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        const msg = JSON.parse(line);
        if (msg.type === "item") {
          collected.push(msg.result);
          onProgress(msg.completed, items.length);
        } else if (msg.type === "done") {
          experiment = msg.experiment;
        }
      }
    }
    if (!experiment) throw new Error("No experiment returned");
    return { model: m, experiment, results: collected };
  };

  const runCompare = async () => {
    if (compareModels.length < 2 || comparing) {
      if (compareModels.length < 2) alert("Pick at least 2 models to compare.");
      return;
    }
    setComparing(true);
    setCompareRuns([]);
    setActiveExp(null);
    setResults([]);
    try {
      const runs: CompareRun[] = [];
      for (let i = 0; i < compareModels.length; i++) {
        const m = compareModels[i];
        setCompareProgress({
          model: m,
          completed: 0,
          total: items.length,
          idx: i + 1,
          count: compareModels.length,
        });
        const run = await runModelStream(m, (completed, total) =>
          setCompareProgress({
            model: m,
            completed,
            total,
            idx: i + 1,
            count: compareModels.length,
          })
        );
        runs.push(run);
        setCompareRuns([...runs]);
      }
      await load();
    } catch (e) {
      alert(`Compare failed: ${(e as Error).message}`);
    } finally {
      setComparing(false);
      setCompareProgress(null);
    }
  };

  const toggleCompareModel = (m: string) =>
    setCompareModels((prev) =>
      prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]
    );

  const viewExperiment = async (expId: string) => {
    const res = await fetch(`/api/experiments/${expId}`);
    const data = await res.json();
    setActiveExp(data.experiment);
    setResults(data.results ?? []);
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
  };

  const deleteDataset = async () => {
    if (!confirm("Delete this dataset, its items, and its experiments?")) return;
    await fetch(`/api/datasets/${id}`, { method: "DELETE" });
    router.push("/datasets");
  };

  if (loading)
    return (
      <div className="flex justify-center py-24 text-muted">
        <Spinner className="h-6 w-6" />
      </div>
    );
  if (notFound || !dataset)
    return (
      <div className="mx-auto max-w-3xl px-6 py-16 text-center text-muted">
        Dataset not found.{" "}
        <Link href="/datasets" className="text-primary underline">
          Back to datasets
        </Link>
      </div>
    );

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <Link href="/datasets" className="text-sm text-muted hover:text-fg">
            ← Datasets
          </Link>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <IconDataset width={20} height={20} className="text-primary" />
            {dataset.name}
          </h1>
          {dataset.description && (
            <p className="mt-1 text-sm text-muted">{dataset.description}</p>
          )}
        </div>
        <Button variant="danger" size="sm" onClick={deleteDataset}>
          <IconTrash width={14} height={14} /> Delete
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        {/* Items */}
        <div className="space-y-4">
          <Card className="space-y-3 p-4">
            <h3 className="text-sm font-medium">Add prompt</h3>
            <Textarea
              rows={2}
              placeholder="Prompt / input…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            <Input
              placeholder="Expected output (optional reference)"
              value={expected}
              onChange={(e) => setExpected(e.target.value)}
            />
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowImport((s) => !s)}
              >
                <IconUpload width={14} height={14} /> Import
              </Button>
              <Button size="sm" onClick={addItem} disabled={!input.trim()}>
                <IconPlus width={14} height={14} /> Add
              </Button>
            </div>
          </Card>

          {showImport && (
            <Card className="space-y-3 p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">Import prompts</h3>
                <label className="cursor-pointer text-xs text-primary hover:underline">
                  Upload file
                  <input
                    type="file"
                    accept=".csv,.json,.txt"
                    className="hidden"
                    onChange={onImportFile}
                  />
                </label>
              </div>
              <Textarea
                rows={4}
                placeholder={`Paste JSON or CSV…\n\nJSON: ["prompt one", "prompt two"]\n  or [{"input":"…","expectedOutput":"…"}]\nCSV: input,expectedOutput`}
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                className="font-mono text-xs"
              />
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setShowImport(false)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={runImport}
                  disabled={importing || !importText.trim()}
                >
                  {importing ? <Spinner /> : <IconUpload width={14} height={14} />}
                  Import
                </Button>
              </div>
            </Card>
          )}

          {items.length > 0 && (
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-medium text-muted">
                {items.length} prompt{items.length === 1 ? "" : "s"}
              </span>
              <div className="flex gap-1">
                <Button variant="subtle" size="sm" onClick={() => exportItems("csv")}>
                  <IconDownload width={13} height={13} /> CSV
                </Button>
                <Button variant="subtle" size="sm" onClick={() => exportItems("json")}>
                  <IconDownload width={13} height={13} /> JSON
                </Button>
              </div>
            </div>
          )}

          {items.length === 0 ? (
            <EmptyState
              icon={<IconDataset width={24} height={24} />}
              title="No prompts yet"
              hint="Add a few prompts above, then run them across a model."
            />
          ) : (
            <div className="space-y-2">
              {items.map((it, i) => (
                <Card key={it.id} className="group flex items-start gap-3 p-3">
                  <span className="mt-0.5 text-xs text-muted-2">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="whitespace-pre-wrap break-words text-sm">
                      {it.input}
                    </div>
                    {it.expectedOutput && (
                      <div className="mt-1 text-xs text-muted">
                        <span className="text-muted-2">expected:</span>{" "}
                        {it.expectedOutput}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => deleteItem(it.id)}
                    className="text-muted-2 opacity-0 transition hover:text-danger group-hover:opacity-100"
                  >
                    <IconTrash width={14} height={14} />
                  </button>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Run panel + history */}
        <div className="space-y-4">
          <Card className="space-y-3 p-4">
            <h3 className="flex items-center gap-2 text-sm font-medium">
              <IconRun width={15} height={15} className="text-primary" /> Run experiment
            </h3>
            <div>
              <label className="mb-1 block text-xs text-muted">Model</label>
              <Select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full"
              >
                {models.map((m) => (
                  <option key={m.name} value={m.name}>
                    {m.name}
                  </option>
                ))}
              </Select>
            </div>
            <Textarea
              rows={2}
              placeholder="Optional system prompt…"
              value={system}
              onChange={(e) => setSystem(e.target.value)}
            />
            <label className="flex items-center gap-2 text-sm text-muted">
              <input
                type="checkbox"
                checked={judge}
                onChange={(e) => setJudge(e.target.checked)}
                className="accent-[var(--primary)]"
              />
              LLM-as-judge scoring
            </label>
            {judge && (
              <Input
                placeholder="Judge criteria (optional)"
                value={criteria}
                onChange={(e) => setCriteria(e.target.value)}
              />
            )}
            <Button
              className="w-full"
              onClick={run}
              disabled={running || !model || items.length === 0}
            >
              {running ? <Spinner /> : <IconRun width={15} height={15} />}
              {running ? "Running…" : `Run on ${items.length} prompts`}
            </Button>
            {running && progress && (
              <div className="space-y-1">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-panel-2">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-300"
                    style={{
                      width: `${(progress.completed / progress.total) * 100}%`,
                    }}
                  />
                </div>
                <p className="text-center text-[11px] text-muted-2">
                  {progress.completed} / {progress.total} prompts
                  {judge ? " · scoring each" : ""}
                </p>
              </div>
            )}
          </Card>

          <Card className="space-y-3 p-4">
            <h3 className="flex items-center gap-2 text-sm font-medium">
              <IconPlayground width={15} height={15} className="text-accent" /> Compare
              models
            </h3>
            <p className="text-xs text-muted">
              Run this dataset across multiple models and see which wins. Uses the
              judge setting above.
            </p>
            <div className="max-h-40 space-y-1 overflow-y-auto">
              {models.map((m) => (
                <label
                  key={m.name}
                  className="flex items-center gap-2 rounded-md px-1 py-1 text-sm text-muted hover:text-fg"
                >
                  <input
                    type="checkbox"
                    checked={compareModels.includes(m.name)}
                    onChange={() => toggleCompareModel(m.name)}
                    className="accent-[var(--primary)]"
                  />
                  {m.name}
                </label>
              ))}
            </div>
            <Button
              className="w-full"
              variant="ghost"
              onClick={runCompare}
              disabled={comparing || compareModels.length < 2 || items.length === 0}
            >
              {comparing ? <Spinner /> : <IconPlayground width={15} height={15} />}
              {comparing
                ? "Comparing…"
                : `Compare ${compareModels.length || ""} models`}
            </Button>
            {comparing && compareProgress && (
              <div className="space-y-1">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-panel-2">
                  <div
                    className="h-full rounded-full bg-accent transition-all duration-300"
                    style={{
                      width: `${(compareProgress.completed / compareProgress.total) * 100}%`,
                    }}
                  />
                </div>
                <p className="text-center text-[11px] text-muted-2">
                  Model {compareProgress.idx}/{compareProgress.count} ·{" "}
                  {compareProgress.model} · {compareProgress.completed}/
                  {compareProgress.total}
                </p>
              </div>
            )}
          </Card>

          {experiments.length > 0 && (
            <Card className="p-4">
              <h3 className="mb-3 text-sm font-medium">Past runs</h3>
              <div className="space-y-2">
                {experiments.map((e) => (
                  <button
                    key={e.id}
                    onClick={() => viewExperiment(e.id)}
                    className="w-full rounded-lg border border-border bg-panel-2 p-2.5 text-left transition hover:border-primary/50"
                  >
                    <div className="flex items-center gap-2">
                      <Badge tone="primary">{e.model}</Badge>
                      {e.avgJudgeScore != null && (
                        <Badge tone="success">judge {e.avgJudgeScore}/10</Badge>
                      )}
                    </div>
                    <div className="mt-1 text-[11px] text-muted-2">
                      {e.itemCount} items · {e.avgLatencyMs} ms avg · {timeAgo(e.createdAt)}
                    </div>
                  </button>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Results */}
      {activeExp && (
        <Card className="mt-6 p-5">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-medium">Results</h3>
            <Badge tone="primary">{activeExp.model}</Badge>
            {activeExp.id === "pending" ? (
              <Badge>
                {results.length}/{activeExp.itemCount} done
              </Badge>
            ) : (
              <>
                <Badge>{activeExp.itemCount} items</Badge>
                <Badge tone="accent">{activeExp.avgLatencyMs} ms avg</Badge>
                {activeExp.avgJudgeScore != null && (
                  <Badge tone="success">avg judge {activeExp.avgJudgeScore}/10</Badge>
                )}
              </>
            )}
            <div className="ml-auto flex gap-1">
              <Button variant="subtle" size="sm" onClick={() => exportResults("csv")}>
                <IconDownload width={13} height={13} /> CSV
              </Button>
              <Button variant="subtle" size="sm" onClick={() => exportResults("json")}>
                <IconDownload width={13} height={13} /> JSON
              </Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted">
                  <th className="pb-2 pr-3 font-medium">Prompt</th>
                  <th className="pb-2 pr-3 font-medium">Output</th>
                  <th className="pb-2 pr-3 text-right font-medium">Latency</th>
                  {activeExp.judgeModel && (
                    <th className="pb-2 pr-3 text-right font-medium">Judge</th>
                  )}
                  <th className="pb-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.id} className="border-t border-border/60 align-top">
                    <td className="max-w-[16rem] py-2 pr-3">
                      <div className="line-clamp-3 text-muted">{r.input}</div>
                    </td>
                    <td className="max-w-[24rem] py-2 pr-3">
                      <div className="line-clamp-4 whitespace-pre-wrap break-words">
                        {r.output}
                      </div>
                      {r.judgeRationale && (
                        <div className="mt-1 text-[11px] italic text-muted-2">
                          {r.judgeRationale}
                        </div>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums text-muted">
                      <span className="inline-flex items-center gap-1">
                        <IconClock width={11} height={11} />
                        {r.latencyMs} ms
                      </span>
                    </td>
                    {activeExp.judgeModel && (
                      <td className="py-2 pr-3 text-right">
                        {r.judgeScore != null ? (
                          <span className="inline-flex items-center gap-1 font-semibold">
                            <IconSparkle width={12} height={12} className="text-primary" />
                            {r.judgeScore}
                          </span>
                        ) : (
                          <span className="text-muted-2">—</span>
                        )}
                      </td>
                    )}
                    <td className="py-2">
                      <Link
                        href={`/traces/${r.traceId}`}
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <IconTraces width={12} height={12} /> trace
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {compareRuns.length > 0 && <ComparisonView items={items} runs={compareRuns} />}
    </div>
  );
}
