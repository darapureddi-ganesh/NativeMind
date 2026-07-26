"use client";

import Link from "next/link";
import { Card, Badge } from "@/components/ui";
import { IconSparkle, IconClock, IconTraces } from "@/components/icons";
import type { DatasetItem, Experiment, ExperimentResult } from "@/lib/types";

export interface CompareRun {
  model: string;
  experiment: Experiment;
  results: ExperimentResult[];
}

export function ComparisonView({
  items,
  runs,
}: {
  items: DatasetItem[];
  runs: CompareRun[];
}) {
  if (runs.length === 0) return null;

  const hasJudge = runs.some((r) => r.experiment.avgJudgeScore != null);

  // Rank: by avg judge score desc when judged, else by avg latency asc.
  const ranked = [...runs].sort((a, b) => {
    if (hasJudge) {
      return (b.experiment.avgJudgeScore ?? -1) - (a.experiment.avgJudgeScore ?? -1);
    }
    return a.experiment.avgLatencyMs - b.experiment.avgLatencyMs;
  });
  const winner = ranked[0]?.model;

  const resultFor = (run: CompareRun, itemId: string) =>
    run.results.find((r) => r.datasetItemId === itemId);

  return (
    <Card className="mt-6 p-5">
      <h3 className="mb-4 text-sm font-medium">Model comparison</h3>

      {/* Scoreboard */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ranked.map((run, i) => {
          const isWinner = run.model === winner;
          return (
            <div
              key={run.model}
              className={
                "rounded-xl border p-4 " +
                (isWinner
                  ? "border-primary/50 bg-primary/8"
                  : "border-border bg-panel-2")
              }
            >
              <div className="flex items-center justify-between">
                <Badge tone={isWinner ? "primary" : "default"}>{run.model}</Badge>
                {isWinner && <Badge tone="success">#1</Badge>}
                {!isWinner && <span className="text-xs text-muted-2">#{i + 1}</span>}
              </div>
              <div className="mt-3 flex items-end gap-4">
                {run.experiment.avgJudgeScore != null && (
                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-muted-2">
                      Avg judge
                    </div>
                    <div className="text-2xl font-semibold tabular-nums">
                      {run.experiment.avgJudgeScore}
                      <span className="text-sm text-muted">/10</span>
                    </div>
                  </div>
                )}
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-muted-2">
                    Avg latency
                  </div>
                  <div className="text-lg font-semibold tabular-nums">
                    {run.experiment.avgLatencyMs}
                    <span className="text-xs text-muted"> ms</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Per-prompt matrix */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-muted">
              <th className="pb-2 pr-3 font-medium">Prompt</th>
              {runs.map((r) => (
                <th key={r.model} className="pb-2 pr-3 font-medium">
                  {r.model}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              // Best cell in this row (max judge, or min latency if unjudged).
              const cells = runs.map((run) => resultFor(run, item.id));
              let bestIdx = -1;
              if (hasJudge) {
                let best = -Infinity;
                cells.forEach((c, i) => {
                  if (c?.judgeScore != null && c.judgeScore > best) {
                    best = c.judgeScore;
                    bestIdx = i;
                  }
                });
              } else {
                let best = Infinity;
                cells.forEach((c, i) => {
                  if (c && c.latencyMs < best) {
                    best = c.latencyMs;
                    bestIdx = i;
                  }
                });
              }
              return (
                <tr key={item.id} className="border-t border-border/60 align-top">
                  <td className="max-w-[16rem] py-2 pr-3">
                    <div className="line-clamp-3 text-muted">{item.input}</div>
                  </td>
                  {cells.map((c, i) => (
                    <td key={i} className="max-w-[18rem] py-2 pr-3">
                      {c ? (
                        <div
                          className={
                            "rounded-lg border p-2 " +
                            (i === bestIdx
                              ? "border-primary/40 bg-primary/8"
                              : "border-border bg-panel-2")
                          }
                        >
                          <div className="mb-1 flex items-center gap-2 text-[11px]">
                            {c.judgeScore != null && (
                              <span className="inline-flex items-center gap-1 font-semibold text-primary">
                                <IconSparkle width={11} height={11} />
                                {c.judgeScore}/10
                              </span>
                            )}
                            <span className="inline-flex items-center gap-1 text-muted-2">
                              <IconClock width={10} height={10} />
                              {c.latencyMs} ms
                            </span>
                            <Link
                              href={`/traces/${c.traceId}`}
                              className="ml-auto text-muted-2 hover:text-primary"
                              title="View trace"
                            >
                              <IconTraces width={11} height={11} />
                            </Link>
                          </div>
                          <div className="line-clamp-3 whitespace-pre-wrap break-words text-xs">
                            {c.output}
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-2">—</span>
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
