"use client";

import { useEffect, useState } from "react";
import { IconSun, IconMoon } from "./icons";

export function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const current =
      document.documentElement.getAttribute("data-theme") === "light"
        ? "light"
        : "dark";
    setTheme(current);
  }, []);

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    if (next === "light") {
      document.documentElement.setAttribute("data-theme", "light");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
    try {
      localStorage.setItem("nativemind-theme", next);
    } catch {
      /* ignore */
    }
  };

  return (
    <button
      onClick={toggle}
      className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-panel-2 px-3 py-2 text-xs text-muted transition hover:text-fg"
      title="Toggle theme"
    >
      {theme === "dark" ? (
        <>
          <IconSun width={14} height={14} /> Light mode
        </>
      ) : (
        <>
          <IconMoon width={14} height={14} /> Dark mode
        </>
      )}
    </button>
  );
}
