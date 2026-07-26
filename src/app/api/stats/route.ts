import { NextResponse } from "next/server";
import { traces, evaluations } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/stats — aggregate metrics for the dashboard
export async function GET() {
  const all = traces.list();
  const evals = evaluations.all();

  const totalCalls = all.length;
  const totalTokens = all.reduce((s, t) => s + (t.totalTokens ?? 0), 0);
  const avgLatency =
    totalCalls > 0
      ? Math.round(all.reduce((s, t) => s + t.latencyMs, 0) / totalCalls)
      : 0;
  const tpsValues = all.map((t) => t.tokensPerSecond).filter((v): v is number => !!v);
  const avgTps =
    tpsValues.length > 0
      ? Number((tpsValues.reduce((s, v) => s + v, 0) / tpsValues.length).toFixed(1))
      : 0;

  // Per-model breakdown
  const byModelMap = new Map<
    string,
    { calls: number; tokens: number; latencySum: number }
  >();
  for (const t of all) {
    const m = byModelMap.get(t.model) ?? { calls: 0, tokens: 0, latencySum: 0 };
    m.calls += 1;
    m.tokens += t.totalTokens ?? 0;
    m.latencySum += t.latencyMs;
    byModelMap.set(t.model, m);
  }
  const byModel = [...byModelMap.entries()]
    .map(([model, m]) => ({
      model,
      calls: m.calls,
      tokens: m.tokens,
      avgLatency: Math.round(m.latencySum / m.calls),
    }))
    .sort((a, b) => b.calls - a.calls);

  // Calls per day (last 14 days)
  const days: { date: string; calls: number; tokens: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const dayTraces = all.filter((t) => t.createdAt.slice(0, 10) === key);
    days.push({
      date: key,
      calls: dayTraces.length,
      tokens: dayTraces.reduce((s, t) => s + (t.totalTokens ?? 0), 0),
    });
  }

  // Eval summary
  const manual = evals.filter((e) => e.type === "manual" && e.score !== null);
  const judge = evals.filter((e) => e.type === "llm_judge" && e.score !== null);
  const avgRating =
    manual.length > 0
      ? Number((manual.reduce((s, e) => s + (e.score ?? 0), 0) / manual.length).toFixed(2))
      : null;
  const avgJudge =
    judge.length > 0
      ? Number((judge.reduce((s, e) => s + (e.score ?? 0), 0) / judge.length).toFixed(2))
      : null;

  return NextResponse.json({
    totals: { totalCalls, totalTokens, avgLatency, avgTps, evalCount: evals.length },
    byModel,
    days,
    evalSummary: { avgRating, avgJudge, manualCount: manual.length, judgeCount: judge.length },
  });
}
