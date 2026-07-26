"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, Button, Input, Textarea, Badge, Spinner, EmptyState } from "@/components/ui";
import { IconDataset, IconPlus } from "@/components/icons";
import { timeAgo } from "@/lib/cn";

interface DatasetRow {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  itemCount: number;
  experimentCount: number;
}

export default function DatasetsPage() {
  const [datasets, setDatasets] = useState<DatasetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const load = () => {
    setLoading(true);
    fetch("/api/datasets")
      .then((r) => r.json())
      .then((d) => setDatasets(d.datasets ?? []))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const create = async () => {
    if (!name.trim()) return;
    await fetch("/api/datasets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description }),
    });
    setName("");
    setDescription("");
    setCreating(false);
    load();
  };

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Datasets</h1>
          <p className="mt-1 text-sm text-muted">
            Collections of prompts you can run through any model and auto-evaluate.
          </p>
        </div>
        <Button onClick={() => setCreating((c) => !c)}>
          <IconPlus width={16} height={16} /> New dataset
        </Button>
      </div>

      {creating && (
        <Card className="mb-6 space-y-3 p-4">
          <Input
            placeholder="Dataset name (e.g. Support FAQ prompts)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Textarea
            rows={2}
            placeholder="Optional description…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={create} disabled={!name.trim()}>
              Create
            </Button>
          </div>
        </Card>
      )}

      {loading ? (
        <div className="flex justify-center py-16 text-muted">
          <Spinner className="h-6 w-6" />
        </div>
      ) : datasets.length === 0 ? (
        <EmptyState
          icon={<IconDataset width={28} height={28} />}
          title="No datasets yet"
          hint="Create one, add a few prompts, then run them across a model with automatic LLM-judge scoring."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {datasets.map((d) => (
            <Link key={d.id} href={`/datasets/${d.id}`}>
              <Card className="p-4 transition hover:border-primary/50">
                <div className="flex items-center gap-2">
                  <IconDataset width={16} height={16} className="text-primary" />
                  <span className="font-medium">{d.name}</span>
                </div>
                {d.description && (
                  <p className="mt-1.5 line-clamp-2 text-sm text-muted">{d.description}</p>
                )}
                <div className="mt-3 flex items-center gap-2">
                  <Badge tone="accent">{d.itemCount} items</Badge>
                  {d.experimentCount > 0 && (
                    <Badge tone="success">{d.experimentCount} runs</Badge>
                  )}
                  <span className="ml-auto text-[11px] text-muted-2">
                    {timeAgo(d.createdAt)}
                  </span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
