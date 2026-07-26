"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import {
  IconDashboard,
  IconChat,
  IconModels,
  IconTraces,
  IconPlayground,
  IconDataset,
  IconSettings,
  IconSparkle,
} from "./icons";
import { ThemeToggle } from "./theme-toggle";

const NAV = [
  { href: "/", label: "Dashboard", icon: IconDashboard },
  { href: "/chat", label: "Chat", icon: IconChat },
  { href: "/models", label: "Models", icon: IconModels },
  { href: "/traces", label: "Traces", icon: IconTraces },
  { href: "/datasets", label: "Datasets", icon: IconDataset },
  { href: "/playground", label: "Playground", icon: IconPlayground },
  { href: "/settings", label: "Settings", icon: IconSettings },
];

function OllamaStatus() {
  const [state, setState] = useState<"checking" | "up" | "down">("checking");
  const [traceCount, setTraceCount] = useState<number | null>(null);
  useEffect(() => {
    let alive = true;
    const check = async () => {
      try {
        const res = await fetch("/api/models");
        const data = await res.json();
        if (alive) setState(data.ok ? "up" : "down");
      } catch {
        if (alive) setState("down");
      }
      try {
        const s = await fetch("/api/stats").then((r) => r.json());
        if (alive) setTraceCount(s.totals?.totalCalls ?? 0);
      } catch {
        /* ignore */
      }
    };
    check();
    const t = setInterval(check, 10000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  const dot =
    state === "up"
      ? "bg-success"
      : state === "down"
        ? "bg-danger"
        : "bg-warning";
  const label =
    state === "up" ? "Ollama connected" : state === "down" ? "Ollama offline" : "Checking…";

  return (
    <div className="rounded-lg border border-border bg-panel-2 px-3 py-2 text-xs text-muted">
      <div className="flex items-center gap-2">
        <span className={cn("h-2 w-2 rounded-full", dot)} />
        {label}
      </div>
      {traceCount != null && (
        <div className="mt-1 text-[11px] text-muted-2">
          {traceCount.toLocaleString()} trace{traceCount === 1 ? "" : "s"} logged
        </div>
      )}
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-border bg-panel/60 px-3 py-4 md:flex">
        <Link href="/" className="mb-6 flex items-center gap-2 px-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <IconSparkle width={18} height={18} />
          </span>
          <span className="text-lg font-semibold tracking-tight">
            Lum<span className="text-primary">eval</span>
          </span>
        </Link>

        <nav className="flex flex-1 flex-col gap-1">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
                  active
                    ? "bg-primary/12 text-primary"
                    : "text-muted hover:bg-panel-2 hover:text-fg"
                )}
              >
                <Icon width={18} height={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-4 space-y-2">
          <OllamaStatus />
          <ThemeToggle />
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border bg-panel/60 px-4 py-3 md:hidden">
          <Link href="/" className="flex items-center gap-2">
            <IconSparkle width={18} height={18} className="text-primary" />
            <span className="font-semibold">Lumeval</span>
          </Link>
          <OllamaStatus />
        </header>
        <nav className="flex gap-1 overflow-x-auto border-b border-border bg-panel/40 px-2 py-2 md:hidden">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "whitespace-nowrap rounded-lg px-3 py-1.5 text-sm",
                isActive(item.href)
                  ? "bg-primary/12 text-primary"
                  : "text-muted"
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
