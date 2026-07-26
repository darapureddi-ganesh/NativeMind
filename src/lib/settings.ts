// User settings persisted to data/settings.json.
import fs from "node:fs";
import path from "node:path";

const DATA_DIR =
  process.env.NATIVEMIND_DATA_DIR || path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "settings.json");

export interface Settings {
  ollamaHost?: string;
  defaultModel?: string;
}

export function getSettings(): Settings {
  try {
    if (!fs.existsSync(FILE)) return {};
    const raw = fs.readFileSync(FILE, "utf-8").trim();
    return raw ? (JSON.parse(raw) as Settings) : {};
  } catch {
    return {};
  }
}

export function saveSettings(patch: Settings): Settings {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const next = { ...getSettings(), ...patch };
  // Drop empty strings so they fall back to defaults.
  (Object.keys(next) as (keyof Settings)[]).forEach((k) => {
    if (next[k] === "" || next[k] == null) delete next[k];
  });
  fs.writeFileSync(FILE, JSON.stringify(next, null, 2), "utf-8");
  return next;
}

export const DEFAULT_OLLAMA_HOST = "http://localhost:11434";

/** Effective Ollama host: user setting → env → default. */
export function resolveOllamaHost(): string {
  const s = getSettings();
  return (s.ollamaHost || process.env.OLLAMA_HOST || DEFAULT_OLLAMA_HOST).replace(
    /\/$/,
    ""
  );
}
