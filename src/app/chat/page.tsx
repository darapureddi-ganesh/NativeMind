"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button, Textarea, Select, Badge, Spinner } from "@/components/ui";
import { IconSend, IconZap, IconClock, IconHash, IconTraces } from "@/components/icons";
import type { OllamaModel, ChatMessage } from "@/lib/types";

interface Metrics {
  latencyMs: number;
  totalTokens?: number;
  tokensPerSecond?: number;
}
interface UIMessage extends ChatMessage {
  metrics?: Metrics;
  traceId?: string;
  streaming?: boolean;
}

export default function ChatPage() {
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [model, setModel] = useState<string>("");
  const [system, setSystem] = useState("");
  const [temperature, setTemperature] = useState(0.7);
  const [showSettings, setShowSettings] = useState(false);
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [conversationId] = useState(() => crypto.randomUUID());
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/models")
      .then((r) => r.json())
      .then((d) => {
        setModels(d.models ?? []);
        if (d.models?.[0]) setModel(d.models[0].name);
      });
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  const send = async () => {
    const content = input.trim();
    if (!content || busy || !model) return;
    setInput("");
    const history: UIMessage[] = [
      ...messages,
      { role: "user", content },
      { role: "assistant", content: "", streaming: true },
    ];
    setMessages(history);
    setBusy(true);

    const payload: ChatMessage[] = history
      .filter((m) => !m.streaming)
      .map(({ role, content }) => ({ role, content }));

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: payload,
          systemPrompt: system || undefined,
          params: { temperature },
          conversationId,
          type: "chat",
        }),
      });
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: "request failed" }));
        throw new Error(err.error || "request failed");
      }
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
          const obj = JSON.parse(line);
          if (obj.delta) {
            setMessages((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              next[next.length - 1] = { ...last, content: last.content + obj.delta };
              return next;
            });
          } else if (obj.done) {
            setMessages((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              next[next.length - 1] = {
                ...last,
                streaming: false,
                traceId: obj.traceId,
                metrics: obj.metrics,
                content: obj.error && !last.content ? `⚠️ ${obj.error}` : last.content,
              };
              return next;
            });
          }
        }
      }
    } catch (e) {
      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        next[next.length - 1] = {
          ...last,
          streaming: false,
          content: `⚠️ ${(e as Error).message}`,
        };
        return next;
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-screen flex-col">
      {/* Header / controls */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-6 py-3">
        <h1 className="mr-2 text-lg font-semibold">Chat</h1>
        <Select value={model} onChange={(e) => setModel(e.target.value)}>
          {models.length === 0 && <option value="">No models</option>}
          {models.map((m) => (
            <option key={m.name} value={m.name}>
              {m.name}
            </option>
          ))}
        </Select>
        <Button variant="ghost" size="sm" onClick={() => setShowSettings((s) => !s)}>
          {showSettings ? "Hide settings" : "Settings"}
        </Button>
        <div className="ml-auto flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setMessages([])}
            disabled={messages.length === 0}
          >
            Clear
          </Button>
        </div>
        {showSettings && (
          <div className="mt-2 w-full space-y-3 rounded-lg border border-border bg-panel-2 p-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">
                System prompt
              </label>
              <Textarea
                rows={2}
                placeholder="You are a helpful assistant…"
                value={system}
                onChange={(e) => setSystem(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-3">
              <label className="text-xs font-medium text-muted">
                Temperature: <span className="text-fg">{temperature.toFixed(2)}</span>
              </label>
              <input
                type="range"
                min={0}
                max={1.5}
                step={0.05}
                value={temperature}
                onChange={(e) => setTemperature(Number(e.target.value))}
                className="flex-1 accent-[var(--primary)]"
              />
            </div>
          </div>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-3xl space-y-5">
          {messages.length === 0 && (
            <div className="mt-20 text-center text-muted">
              <p className="text-sm">
                Start a conversation with{" "}
                <span className="text-fg">{model || "a model"}</span>. Every reply is
                logged as a trace you can evaluate.
              </p>
            </div>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              className={m.role === "user" ? "flex justify-end" : "flex justify-start"}
            >
              <div className={m.role === "user" ? "max-w-[85%]" : "w-full max-w-[85%]"}>
                <div
                  className={
                    m.role === "user"
                      ? "rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-fg"
                      : "rounded-2xl rounded-bl-sm border border-border bg-panel px-4 py-3 text-sm"
                  }
                >
                  <div className="prose-chat whitespace-pre-wrap break-words">
                    {m.content}
                    {m.streaming && (
                      <span className="ml-1 inline-block h-3.5 w-1.5 animate-pulse bg-primary align-middle" />
                    )}
                  </div>
                </div>
                {m.metrics && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 pl-1 text-[11px] text-muted-2">
                    <span className="inline-flex items-center gap-1">
                      <IconClock width={11} height={11} />
                      {m.metrics.latencyMs} ms
                    </span>
                    {m.metrics.totalTokens != null && (
                      <span className="inline-flex items-center gap-1">
                        <IconHash width={11} height={11} />
                        {m.metrics.totalTokens} tok
                      </span>
                    )}
                    {m.metrics.tokensPerSecond != null && (
                      <span className="inline-flex items-center gap-1">
                        <IconZap width={11} height={11} />
                        {m.metrics.tokensPerSecond} tok/s
                      </span>
                    )}
                    {m.traceId && (
                      <Link
                        href={`/traces/${m.traceId}`}
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        <IconTraces width={11} height={11} /> View trace
                      </Link>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Composer */}
      <div className="border-t border-border px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-3xl items-end gap-2">
          <Textarea
            rows={1}
            placeholder={model ? `Message ${model}…` : "Install a model first"}
            value={input}
            disabled={!model}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            className="max-h-40 min-h-[44px]"
          />
          <Button onClick={send} disabled={busy || !input.trim() || !model}>
            {busy ? <Spinner /> : <IconSend width={16} height={16} />}
          </Button>
        </div>
        <p className="mx-auto mt-1.5 max-w-3xl text-center text-[11px] text-muted-2">
          Enter to send · Shift+Enter for newline
        </p>
      </div>
    </div>
  );
}
