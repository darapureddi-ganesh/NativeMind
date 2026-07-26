"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, Badge, Button, Spinner } from "@/components/ui";
import {
  IconTraces,
  IconClock,
  IconZap,
  IconHash,
  IconStar,
  IconChat,
} from "@/components/icons";

interface Stats {
  totals: {
    totalCalls: number;
    totalTokens: number;
    avgLatency: number;
    avgTps: number;
    evalCount: number;
  };
  byModel: { model: string; calls: number; tokens: number; avgLatency: number }[];
  days: { date: string; calls: number; tokens: number }[];
  evalSummary: {
    avgRating: number | null;
    avgJudge: number | null;
    manualCount: number;
    judgeCount: number;
  };
}

function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <Card className="p-4">
      <div className="mb-2 flex items-center gap-2 text-muted">
        <span className="text-primary">{icon}</span>
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      {sub && <div className="mt-1 text-xs text-muted">{sub}</div>}
    </Card>
  );
}

function BarChart({ data }: { data: { date: string; calls: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.calls));
  return (
    <div className="flex h-40 items-end gap-1.5">
      {data.map((d) => (
        <div key={d.date} className="group flex flex-1 flex-col items-center gap-1">
          <div className="relative flex w-full flex-1 items-end">
            <div
              className="w-full rounded-t bg-primary/70 transition group-hover:bg-primary"
              style={{ height: `${(d.calls / max) * 100}%`, minHeight: d.calls ? 4 : 0 }}
              title={`${d.date}: ${d.calls} calls`}
            />
          </div>
          <span className="text-[9px] text-muted-2">{d.date.slice(5)}</span>
        </div>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then(setStats)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-muted">
            Observability for every call to your local models.
          </p>
        </div>
        <Link href="/chat">
          <Button>
            <IconChat width={16} height={16} /> New chat
          </Button>
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-20 text-muted">
          <Spinner className="h-6 w-6" />
        </div>
      ) : !stats || stats.totals.totalCalls === 0 ? (
        <Card className="p-10 text-center">
          <h2 className="text-lg font-medium">No traces yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">
            Head to the Chat or Playground and talk to one of your local models.
            Every call is automatically logged here with tokens, latency, and
            speed — ready to evaluate.
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <Link href="/chat">
              <Button>Start chatting</Button>
            </Link>
            <Link href="/models">
              <Button variant="ghost">Manage models</Button>
            </Link>
          </div>
        </Card>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard
              icon={<IconTraces width={16} height={16} />}
              label="Total calls"
              value={stats.totals.totalCalls.toLocaleString()}
              sub={`${stats.totals.evalCount} evaluations`}
            />
            <StatCard
              icon={<IconHash width={16} height={16} />}
              label="Tokens"
              value={stats.totals.totalTokens.toLocaleString()}
            />
            <StatCard
              icon={<IconClock width={16} height={16} />}
              label="Avg latency"
              value={`${stats.totals.avgLatency} ms`}
            />
            <StatCard
              icon={<IconZap width={16} height={16} />}
              label="Avg speed"
              value={`${stats.totals.avgTps} tok/s`}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="p-5 lg:col-span-2">
              <h3 className="mb-4 text-sm font-medium">Calls — last 14 days</h3>
              <BarChart data={stats.days} />
            </Card>

            <Card className="p-5">
              <h3 className="mb-4 flex items-center gap-2 text-sm font-medium">
                <IconStar width={15} height={15} className="text-warning" />
                Evaluations
              </h3>
              <div className="space-y-4">
                <div>
                  <div className="text-xs text-muted">Avg manual rating</div>
                  <div className="text-xl font-semibold">
                    {stats.evalSummary.avgRating ?? "—"}
                    {stats.evalSummary.avgRating != null && (
                      <span className="text-sm text-muted"> / 5</span>
                    )}
                  </div>
                  <div className="text-[11px] text-muted-2">
                    {stats.evalSummary.manualCount} rated
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted">Avg LLM-judge score</div>
                  <div className="text-xl font-semibold">
                    {stats.evalSummary.avgJudge ?? "—"}
                    {stats.evalSummary.avgJudge != null && (
                      <span className="text-sm text-muted"> / 10</span>
                    )}
                  </div>
                  <div className="text-[11px] text-muted-2">
                    {stats.evalSummary.judgeCount} judged
                  </div>
                </div>
              </div>
            </Card>
          </div>

          <Card className="p-5">
            <h3 className="mb-4 text-sm font-medium">By model</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-muted">
                    <th className="pb-2 font-medium">Model</th>
                    <th className="pb-2 text-right font-medium">Calls</th>
                    <th className="pb-2 text-right font-medium">Tokens</th>
                    <th className="pb-2 text-right font-medium">Avg latency</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.byModel.map((m) => (
                    <tr key={m.model} className="border-t border-border/60">
                      <td className="py-2">
                        <Badge tone="primary">{m.model}</Badge>
                      </td>
                      <td className="py-2 text-right tabular-nums">{m.calls}</td>
                      <td className="py-2 text-right tabular-nums">
                        {m.tokens.toLocaleString()}
                      </td>
                      <td className="py-2 text-right tabular-nums">{m.avgLatency} ms</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
