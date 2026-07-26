import { NextRequest, NextResponse } from "next/server";
import { evaluations, traces, newId, nowIso } from "@/lib/store";
import { chatOnce } from "@/lib/ollama";
import type { Evaluation } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/evaluations?traceId= — evaluations for a trace (or all)
export async function GET(req: NextRequest) {
  const traceId = new URL(req.url).searchParams.get("traceId");
  return NextResponse.json({
    evaluations: traceId ? evaluations.byTrace(traceId) : evaluations.all(),
  });
}

interface EvalBody {
  traceId: string;
  type: "manual" | "auto" | "llm_judge";
  name?: string;
  score?: number;
  label?: string;
  rationale?: string;
  judgeModel?: string;
  criteria?: string;
}

// POST /api/evaluations — create an evaluation (manual, auto-metrics, or LLM judge)
export async function POST(req: NextRequest) {
  const body = (await req.json()) as EvalBody;
  const trace = traces.get(body.traceId);
  if (!trace) {
    return NextResponse.json({ error: "trace not found" }, { status: 404 });
  }

  const base = { id: newId(), traceId: body.traceId, createdAt: nowIso() };

  // 1) Manual rating
  if (body.type === "manual") {
    const ev: Evaluation = {
      ...base,
      type: "manual",
      name: body.name || "rating",
      score: typeof body.score === "number" ? body.score : null,
      label: body.label,
      rationale: body.rationale,
    };
    evaluations.insert(ev);
    return NextResponse.json({ evaluations: [ev] });
  }

  // 2) Automatic metrics (deterministic, no model call)
  if (body.type === "auto") {
    const text = trace.output || "";
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const metrics: Array<{ name: string; score: number }> = [
      { name: "word_count", score: words },
      { name: "char_count", score: text.length },
      { name: "latency_ms", score: trace.latencyMs },
      { name: "tokens_per_second", score: trace.tokensPerSecond ?? 0 },
    ];
    const created = metrics.map((m) => {
      const ev: Evaluation = {
        id: newId(),
        traceId: body.traceId,
        createdAt: nowIso(),
        type: "auto",
        name: m.name,
        score: m.score,
      };
      evaluations.insert(ev);
      return ev;
    });
    return NextResponse.json({ evaluations: created });
  }

  // 3) LLM-as-judge (uses a local model to score the output 1–10)
  if (body.type === "llm_judge") {
    const judgeModel = body.judgeModel || trace.model;
    const criteria =
      body.criteria ||
      "overall helpfulness, correctness, and clarity of the response";
    const userPrompt =
      trace.input.filter((m) => m.role === "user").map((m) => m.content).join("\n\n") ||
      "(no user prompt)";

    const judgePrompt = `You are a strict evaluation judge. Score the ASSISTANT RESPONSE on ${criteria}.
Return ONLY a compact JSON object: {"score": <integer 1-10>, "rationale": "<one sentence>"}.

USER PROMPT:
${userPrompt}

ASSISTANT RESPONSE:
${trace.output}`;

    try {
      const raw = await chatOnce({
        model: judgeModel,
        messages: [{ role: "user", content: judgePrompt }],
        params: { temperature: 0 },
      });
      const match = raw.match(/\{[\s\S]*\}/);
      let score: number | null = null;
      let rationale = raw.trim();
      if (match) {
        try {
          const parsed = JSON.parse(match[0]) as {
            score?: number;
            rationale?: string;
          };
          score = typeof parsed.score === "number" ? parsed.score : null;
          rationale = parsed.rationale || rationale;
        } catch {
          /* fall back to raw text */
        }
      }
      const ev: Evaluation = {
        ...base,
        type: "llm_judge",
        name: "llm_judge",
        score,
        rationale: rationale.slice(0, 500),
      };
      evaluations.insert(ev);
      return NextResponse.json({ evaluations: [ev] });
    } catch (e) {
      return NextResponse.json(
        { error: `Judge failed: ${(e as Error).message}` },
        { status: 502 }
      );
    }
  }

  return NextResponse.json({ error: "unknown evaluation type" }, { status: 400 });
}

// DELETE /api/evaluations?id= — remove one evaluation
export async function DELETE(req: NextRequest) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  evaluations.remove(id);
  return NextResponse.json({ ok: true });
}
