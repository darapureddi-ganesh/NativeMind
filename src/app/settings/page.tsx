"use client";

import { useEffect, useState } from "react";
import { Card, Button, Input, Select, Badge, Spinner } from "@/components/ui";
import { IconSettings, IconCheck, IconTrash, IconRefresh } from "@/components/icons";
import type { OllamaModel } from "@/lib/types";

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [ollamaHost, setOllamaHost] = useState("");
  const [effectiveHost, setEffectiveHost] = useState("");
  const [envHost, setEnvHost] = useState<string | null>(null);
  const [defaultModel, setDefaultModel] = useState("");
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [connected, setConnected] = useState<boolean | null>(null);

  const loadModels = async () => {
    const d = await fetch("/api/models").then((r) => r.json());
    setModels(d.models ?? []);
    setConnected(!!d.ok);
  };

  useEffect(() => {
    (async () => {
      const s = await fetch("/api/settings").then((r) => r.json());
      setOllamaHost(s.settings?.ollamaHost ?? "");
      setEffectiveHost(s.effectiveHost ?? "");
      setEnvHost(s.envHost ?? null);
      setDefaultModel(s.settings?.defaultModel ?? "");
      await loadModels();
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ollamaHost, defaultModel }),
      });
      const data = await res.json();
      setEffectiveHost(data.effectiveHost ?? effectiveHost);
      await loadModels();
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  const clearTraces = async () => {
    if (!confirm("Delete ALL traces and evaluations? This cannot be undone.")) return;
    await fetch("/api/traces", { method: "DELETE" });
    alert("Traces and evaluations cleared.");
  };

  const resetAll = async () => {
    if (
      !confirm(
        "Reset EVERYTHING? This deletes all traces, conversations, datasets, and experiments. This cannot be undone."
      )
    )
      return;
    await fetch("/api/data/reset", { method: "POST" });
    alert("All data reset.");
  };

  if (loading)
    return (
      <div className="flex justify-center py-24 text-muted">
        <Spinner className="h-6 w-6" />
      </div>
    );

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
        <IconSettings width={22} height={22} className="text-primary" /> Settings
      </h1>
      <p className="mt-1 text-sm text-muted">
        Configure the Ollama connection and manage your local data.
      </p>

      {/* Connection */}
      <Card className="mt-6 space-y-4 p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">Ollama connection</h2>
          {connected != null && (
            <Badge tone={connected ? "success" : "danger"}>
              {connected ? "connected" : "offline"}
            </Badge>
          )}
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted">Ollama host URL</label>
          <Input
            placeholder={effectiveHost || "http://localhost:11434"}
            value={ollamaHost}
            onChange={(e) => setOllamaHost(e.target.value)}
          />
          <p className="mt-1.5 text-[11px] text-muted-2">
            Effective: <span className="font-mono">{effectiveHost}</span>
            {envHost && (
              <>
                {" "}
                · env <span className="font-mono">OLLAMA_HOST={envHost}</span>
              </>
            )}
            . Leave blank to use the env var or default.
          </p>
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted">Default model</label>
          <Select
            value={defaultModel}
            onChange={(e) => setDefaultModel(e.target.value)}
            className="w-full"
          >
            <option value="">First available</option>
            {models.map((m) => (
              <option key={m.name} value={m.name}>
                {m.name}
              </option>
            ))}
          </Select>
          <p className="mt-1.5 text-[11px] text-muted-2">
            Pre-selected in Chat, Playground, and Datasets.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={save} disabled={saving}>
            {saving ? <Spinner /> : saved ? <IconCheck width={16} height={16} /> : null}
            {saved ? "Saved" : "Save settings"}
          </Button>
          <Button variant="ghost" onClick={loadModels}>
            <IconRefresh width={16} height={16} /> Test connection
          </Button>
        </div>
      </Card>

      {/* Data management */}
      <Card className="mt-6 space-y-4 p-5">
        <h2 className="text-sm font-medium">Data management</h2>
        <p className="text-xs text-muted">
          Lumeval stores everything locally as JSON files. These actions are
          permanent.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="danger" onClick={clearTraces}>
            <IconTrash width={15} height={15} /> Clear traces & evaluations
          </Button>
          <Button variant="danger" onClick={resetAll}>
            <IconTrash width={15} height={15} /> Reset all data
          </Button>
        </div>
      </Card>
    </div>
  );
}
