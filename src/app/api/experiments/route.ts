import { NextRequest, NextResponse } from "next/server";
import {
  datasets,
  datasetItems,
  experiments,
  experimentResults,
  traces,
  evaluations,
  newId,
  nowIso,
} from "@/lib/store";
import { chatOnceDetailed, chatOnce, ping } from "@/lib/ollama";
import type { Trace, Experiment, ExperimentResult, ChatMessage } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// GET /api/experiments — list all experiments
export async function GET() {
  return NextResponse.json({ experiments: experiments.list() });
}

interface RunBody {
  datasetId: string;
  model: string;
  systemPrompt?: string;
  judge?: { enabled: boolean; judgeModel?: string; criteria?: string };
}

// POST /api/experiments — run every dataset item through the model (+ optional
// judge), streaming NDJSON progress: {type:"start"}, {type:"item"} per item,
// then {type:"done", experiment}.
export async function POST(req: NextRequest) {
  if (!(await ping())) {
    return NextResponse.json({ error: "Ollama is not reachable." }, { status: 502 });
  }
  const body = (await req.json()) as RunBody;
  const dataset = datasets.get(body.datasetId);
  if (!dataset) {
    return NextResponse.json({ error: "dataset not found" }, { status: 404 });
  }
  const items = datasetItems.byDataset(body.datasetId);
  if (items.length === 0) {
    return NextResponse.json({ error: "dataset has no items" }, { status: 400 });
  }
  if (!body.model) {
    return NextResponse.json({ error: "model is required" }, { status: 400 });
  }

  const experimentId = newId();
  const judgeEnabled = !!body.judge?.enabled;
  const judgeModel = body.judge?.judgeModel || body.model;
  const criteria =
    body.judge?.criteria ||
    "overall helpfulness, correctness, and clarity of the response";

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (o: unknown) =>
        controller.enqueue(encoder.encode(JSON.stringify(o) + "\n"));

      send({ type: "start", experimentId, total: items.length });

      const results: ExperimentResult[] = [];
      let latencySum = 0;
      const judgeScores: number[] = [];

      for (let index = 0; index < items.length; index++) {
        const item = items[index];
        const messages: ChatMessage[] = body.systemPrompt
          ? [
              { role: "system", content: body.systemPrompt },
              { role: "user", content: item.input },
            ]
          : [{ role: "user", content: item.input }];

        const started = Date.now();
        let output = "";
        let totalTokens: number | undefined;
        let tokensPerSecond: number | undefined;
        let promptTokens: number | undefined;
        let completionTokens: number | undefined;
        let error: string | undefined;
        try {
          const r = await chatOnceDetailed({ model: body.model, messages });
          output = r.content;
          totalTokens = r.totalTokens;
          tokensPerSecond = r.tokensPerSecond;
          promptTokens = r.promptTokens;
          completionTokens = r.completionTokens;
        } catch (e) {
          error = (e as Error).message;
        }
        const latencyMs = Date.now() - started;
        latencySum += latencyMs;

        const trace: Trace = {
          id: newId(),
          createdAt: nowIso(),
          type: "experiment",
          model: body.model,
          systemPrompt: body.systemPrompt,
          input: [{ role: "user", content: item.input }],
          output,
          params: {},
          promptTokens,
          completionTokens,
          totalTokens,
          latencyMs,
          tokensPerSecond,
          error,
        };
        traces.insert(trace);

        let judgeScore: number | null | undefined;
        let judgeRationale: string | undefined;
        if (judgeEnabled && output) {
          try {
            const judgePrompt = `You are a strict evaluation judge. Score the ASSISTANT RESPONSE on ${criteria}.${
              item.expectedOutput
                ? `\nA REFERENCE answer is provided; reward responses that match it.`
                : ""
            }
Return ONLY compact JSON: {"score": <integer 1-10>, "rationale": "<one sentence>"}.

USER PROMPT:
${item.input}
${item.expectedOutput ? `\nREFERENCE:\n${item.expectedOutput}\n` : ""}
ASSISTANT RESPONSE:
${output}`;
            const raw = await chatOnce({
              model: judgeModel,
              messages: [{ role: "user", content: judgePrompt }],
              params: { temperature: 0 },
            });
            const match = raw.match(/\{[\s\S]*\}/);
            if (match) {
              const parsed = JSON.parse(match[0]) as {
                score?: number;
                rationale?: string;
              };
              judgeScore = typeof parsed.score === "number" ? parsed.score : null;
              judgeRationale = parsed.rationale;
            }
            if (typeof judgeScore === "number") {
              judgeScores.push(judgeScore);
              evaluations.insert({
                id: newId(),
                traceId: trace.id,
                type: "llm_judge",
                name: "llm_judge",
                score: judgeScore,
                rationale: judgeRationale,
                createdAt: nowIso(),
              });
            }
          } catch {
            /* judge failure is non-fatal */
          }
        }

        const result: ExperimentResult = {
          id: newId(),
          experimentId,
          datasetItemId: item.id,
          traceId: trace.id,
          input: item.input,
          output: error ? `⚠️ ${error}` : output,
          latencyMs,
          totalTokens,
          judgeScore: judgeEnabled ? (judgeScore ?? null) : undefined,
          judgeRationale,
        };
        experimentResults.insert(result);
        results.push(result);

        send({ type: "item", index, completed: index + 1, result });
      }

      const avgJudgeScore =
        judgeScores.length > 0
          ? Number(
              (judgeScores.reduce((s, v) => s + v, 0) / judgeScores.length).toFixed(2)
            )
          : null;

      const experiment: Experiment = {
        id: experimentId,
        datasetId: body.datasetId,
        datasetName: dataset.name,
        model: body.model,
        systemPrompt: body.systemPrompt,
        judgeModel: judgeEnabled ? judgeModel : undefined,
        createdAt: nowIso(),
        itemCount: items.length,
        avgLatencyMs: Math.round(latencySum / items.length),
        avgJudgeScore,
      };
      experiments.insert(experiment);

      send({ type: "done", experiment });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
}
