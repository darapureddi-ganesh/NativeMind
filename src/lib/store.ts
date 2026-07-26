// Lightweight JSON-file data store. Zero native dependencies so the app
// clones and runs anywhere Node runs. Structured as a small repository layer
// (a swap to SQLite later only touches this file).
//
// Each collection is a JSON array persisted to its own file under the data dir.
// Reads/writes are synchronous and read-through/write-through — fine for a
// local, single-user observability tool.

import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type {
  Trace,
  Conversation,
  StoredMessage,
  Evaluation,
} from "./types";

const DATA_DIR =
  process.env.LUMEVAL_DATA_DIR || path.join(process.cwd(), "data");

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function filePath(collection: string) {
  return path.join(DATA_DIR, `${collection}.json`);
}

function readAll<T>(collection: string): T[] {
  ensureDir();
  const fp = filePath(collection);
  if (!fs.existsSync(fp)) return [];
  try {
    const raw = fs.readFileSync(fp, "utf-8").trim();
    if (!raw) return [];
    return JSON.parse(raw) as T[];
  } catch {
    return [];
  }
}

function writeAll<T>(collection: string, rows: T[]) {
  ensureDir();
  const fp = filePath(collection);
  const tmp = `${fp}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(rows, null, 2), "utf-8");
  fs.renameSync(tmp, fp); // atomic-ish replace
}

export function newId(): string {
  return randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}

/* ---------------------------------- Traces --------------------------------- */

export const traces = {
  list(filter?: { model?: string; type?: string; limit?: number }): Trace[] {
    let rows = readAll<Trace>("traces").sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt)
    );
    if (filter?.model) rows = rows.filter((r) => r.model === filter.model);
    if (filter?.type) rows = rows.filter((r) => r.type === filter.type);
    if (filter?.limit) rows = rows.slice(0, filter.limit);
    return rows;
  },
  get(id: string): Trace | undefined {
    return readAll<Trace>("traces").find((r) => r.id === id);
  },
  insert(trace: Trace): Trace {
    const rows = readAll<Trace>("traces");
    rows.push(trace);
    writeAll("traces", rows);
    return trace;
  },
  remove(id: string): void {
    writeAll(
      "traces",
      readAll<Trace>("traces").filter((r) => r.id !== id)
    );
    // cascade evaluations
    writeAll(
      "evaluations",
      readAll<Evaluation>("evaluations").filter((e) => e.traceId !== id)
    );
  },
};

/* ------------------------------ Conversations ------------------------------ */

export const conversations = {
  list(): Conversation[] {
    return readAll<Conversation>("conversations").sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt)
    );
  },
  get(id: string): Conversation | undefined {
    return readAll<Conversation>("conversations").find((r) => r.id === id);
  },
  upsert(conv: Conversation): Conversation {
    const rows = readAll<Conversation>("conversations");
    const idx = rows.findIndex((r) => r.id === conv.id);
    if (idx >= 0) rows[idx] = conv;
    else rows.push(conv);
    writeAll("conversations", rows);
    return conv;
  },
  remove(id: string): void {
    writeAll(
      "conversations",
      readAll<Conversation>("conversations").filter((r) => r.id !== id)
    );
    writeAll(
      "messages",
      readAll<StoredMessage>("messages").filter((m) => m.conversationId !== id)
    );
  },
};

/* --------------------------------- Messages -------------------------------- */

export const messages = {
  byConversation(conversationId: string): StoredMessage[] {
    return readAll<StoredMessage>("messages")
      .filter((m) => m.conversationId === conversationId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },
  insert(msg: StoredMessage): StoredMessage {
    const rows = readAll<StoredMessage>("messages");
    rows.push(msg);
    writeAll("messages", rows);
    return msg;
  },
};

/* ------------------------------- Evaluations ------------------------------- */

export const evaluations = {
  all(): Evaluation[] {
    return readAll<Evaluation>("evaluations");
  },
  byTrace(traceId: string): Evaluation[] {
    return readAll<Evaluation>("evaluations")
      .filter((e) => e.traceId === traceId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  insert(evaluation: Evaluation): Evaluation {
    const rows = readAll<Evaluation>("evaluations");
    rows.push(evaluation);
    writeAll("evaluations", rows);
    return evaluation;
  },
  remove(id: string): void {
    writeAll(
      "evaluations",
      readAll<Evaluation>("evaluations").filter((e) => e.id !== id)
    );
  },
};
