"use client";

import { useEffect, useState } from "react";
import { Card, Button, Input, Badge, Spinner, EmptyState } from "@/components/ui";
import { IconModels, IconDownload, IconTrash, IconRefresh } from "@/components/icons";
import { formatBytes, timeAgo } from "@/lib/cn";
import type { OllamaModel } from "@/lib/types";

export default function ModelsPage() {
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [ok, setOk] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [pullName, setPullName] = useState("");
  const [pullStatus, setPullStatus] = useState<string | null>(null);
  const [pulling, setPulling] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/models");
      const data = await res.json();
      setOk(data.ok);
      setModels(data.models ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const pull = async () => {
    const name = pullName.trim();
    if (!name || pulling) return;
    setPulling(true);
    setPullStatus("Starting…");
    try {
      const res = await fetch("/api/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.body) throw new Error("no stream");
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
          try {
            const obj = JSON.parse(line);
            if (obj.error) {
              setPullStatus(`Error: ${obj.error}`);
            } else if (obj.status) {
              const pct =
                obj.total && obj.completed
                  ? ` ${Math.round((obj.completed / obj.total) * 100)}%`
                  : "";
              setPullStatus(`${obj.status}${pct}`);
            }
          } catch {
            /* ignore partial */
          }
        }
      }
      setPullStatus("Done");
      setPullName("");
      await load();
    } catch (e) {
      setPullStatus(`Error: ${(e as Error).message}`);
    } finally {
      setPulling(false);
      setTimeout(() => setPullStatus(null), 4000);
    }
  };

  const remove = async (name: string) => {
    if (!confirm(`Delete model "${name}"? This removes it from Ollama.`)) return;
    await fetch("/api/models", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    await load();
  };

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Models</h1>
          <p className="mt-1 text-sm text-muted">
            Your locally installed Ollama models.
          </p>
        </div>
        <Button variant="ghost" onClick={load} disabled={loading}>
          <IconRefresh width={16} height={16} /> Refresh
        </Button>
      </div>

      {/* Pull */}
      <Card className="mb-6 p-4">
        <label className="mb-2 block text-sm font-medium">Pull a new model</label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            placeholder="e.g. llama3.2, qwen2.5:7b, phi3"
            value={pullName}
            onChange={(e) => setPullName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && pull()}
            disabled={pulling}
          />
          <Button onClick={pull} disabled={pulling || !pullName.trim()}>
            {pulling ? <Spinner /> : <IconDownload width={16} height={16} />}
            {pulling ? "Pulling" : "Pull"}
          </Button>
        </div>
        {pullStatus && (
          <p className="mt-2 font-mono text-xs text-accent">{pullStatus}</p>
        )}
        <p className="mt-2 text-xs text-muted-2">
          Browse the library at ollama.com/library — names go in as shown.
        </p>
      </Card>

      {loading ? (
        <div className="flex justify-center py-16 text-muted">
          <Spinner className="h-6 w-6" />
        </div>
      ) : ok === false ? (
        <EmptyState
          icon={<IconModels width={28} height={28} />}
          title="Ollama isn't reachable"
          hint="Start Ollama (it usually runs at http://localhost:11434). Set OLLAMA_HOST if it's elsewhere, then refresh."
        />
      ) : models.length === 0 ? (
        <EmptyState
          icon={<IconModels width={28} height={28} />}
          title="No models installed"
          hint="Pull one above to get started — llama3.2 is a good small default."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {models.map((m) => (
            <Card key={m.name} className="flex items-start justify-between p-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <IconModels width={16} height={16} className="text-primary" />
                  <span className="truncate font-medium">{m.name}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {m.parameterSize && <Badge>{m.parameterSize}</Badge>}
                  {m.family && <Badge tone="accent">{m.family}</Badge>}
                  {m.quantization && <Badge>{m.quantization}</Badge>}
                </div>
                <div className="mt-2 text-xs text-muted-2">
                  {formatBytes(m.size)} · updated {timeAgo(m.modifiedAt)}
                </div>
              </div>
              <Button
                variant="danger"
                size="sm"
                onClick={() => remove(m.name)}
                title="Delete model"
              >
                <IconTrash width={14} height={14} />
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
