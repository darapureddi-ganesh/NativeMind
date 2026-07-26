// Shared domain types for Lumeval.

export type Role = "system" | "user" | "assistant";

export interface ChatMessage {
  role: Role;
  content: string;
}

export interface TraceParams {
  temperature?: number;
  top_p?: number;
  num_predict?: number;
  [key: string]: unknown;
}

/** A single logged LLM call — the core observability record. */
export interface Trace {
  id: string;
  createdAt: string; // ISO timestamp
  type: "chat" | "playground" | "experiment";
  model: string;
  systemPrompt?: string;
  input: ChatMessage[]; // full message list sent to the model
  output: string; // assistant response text
  params: TraceParams;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  latencyMs: number;
  tokensPerSecond?: number;
  conversationId?: string;
  error?: string;
}

export interface Conversation {
  id: string;
  title: string;
  model: string;
  systemPrompt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StoredMessage {
  id: string;
  conversationId: string;
  role: Role;
  content: string;
  traceId?: string;
  createdAt: string;
}

export type EvaluationType = "manual" | "auto" | "llm_judge";

/** A score/label attached to a trace. */
export interface Evaluation {
  id: string;
  traceId: string;
  type: EvaluationType;
  name: string; // metric name, e.g. "helpfulness", "response_length"
  score: number | null; // numeric value (rating, metric, or judge score)
  label?: string; // optional categorical label, e.g. "good"/"bad"
  rationale?: string; // free text or judge explanation
  createdAt: string;
}

/* ---------------------------- Datasets & batches --------------------------- */

export interface Dataset {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
}

export interface DatasetItem {
  id: string;
  datasetId: string;
  input: string; // the prompt to send
  expectedOutput?: string; // optional reference answer
  createdAt: string;
}

export interface Experiment {
  id: string;
  datasetId: string;
  datasetName: string;
  model: string;
  systemPrompt?: string;
  judgeModel?: string;
  createdAt: string;
  itemCount: number;
  avgLatencyMs: number;
  avgJudgeScore: number | null;
}

export interface ExperimentResult {
  id: string;
  experimentId: string;
  datasetItemId: string;
  traceId: string;
  input: string;
  output: string;
  latencyMs: number;
  totalTokens?: number;
  judgeScore?: number | null;
  judgeRationale?: string;
}

export interface OllamaModel {
  name: string;
  model: string;
  size: number;
  modifiedAt: string;
  family?: string;
  parameterSize?: string;
  quantization?: string;
}
