import * as React from "react";
import { cn } from "@/lib/cn";

/* -------------------------------- Button --------------------------------- */
type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger" | "subtle";
  size?: "sm" | "md";
};

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition select-none disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40";

const buttonVariants: Record<string, string> = {
  primary: "bg-primary text-primary-fg hover:bg-primary-hover",
  ghost: "border border-border bg-panel-2 text-fg hover:border-primary/50 hover:text-white",
  danger: "border border-danger/30 bg-danger/10 text-danger hover:bg-danger/20",
  subtle: "text-muted hover:text-fg hover:bg-panel-2",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        buttonBase,
        buttonVariants[variant],
        size === "sm" ? "px-2.5 py-1.5 text-xs" : "px-3.5 py-2 text-sm",
        className
      )}
      {...props}
    />
  );
}

/* --------------------------------- Card ---------------------------------- */
export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-xl border border-border bg-panel", className)}
      {...props}
    />
  );
}

/* --------------------------------- Badge --------------------------------- */
export function Badge({
  className,
  tone = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  tone?: "default" | "primary" | "success" | "warning" | "danger" | "accent";
}) {
  const tones: Record<string, string> = {
    default: "border-border bg-panel-2 text-muted",
    primary: "border-primary/30 bg-primary/10 text-primary",
    success: "border-success/30 bg-success/10 text-success",
    warning: "border-warning/30 bg-warning/10 text-warning",
    danger: "border-danger/30 bg-danger/10 text-danger",
    accent: "border-accent/30 bg-accent/10 text-accent",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium",
        tones[tone],
        className
      )}
      {...props}
    />
  );
}

/* -------------------------------- Inputs --------------------------------- */
export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function Input({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cn(
        "w-full rounded-lg border border-border bg-panel-2 px-3 py-2 text-sm text-fg placeholder:text-muted-2 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/25",
        className
      )}
      {...props}
    />
  );
});

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(
        "w-full rounded-lg border border-border bg-panel-2 px-3 py-2 text-sm text-fg placeholder:text-muted-2 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/25 resize-none",
        className
      )}
      {...props}
    />
  );
});

export function Select({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "rounded-lg border border-border bg-panel-2 px-3 py-2 text-sm text-fg outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/25",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}

/* -------------------------------- Spinner -------------------------------- */
export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "spin inline-block rounded-full border-2 border-current border-t-transparent",
        className || "h-4 w-4"
      )}
      aria-hidden
    />
  );
}

/* ------------------------------- EmptyState ------------------------------ */
export function EmptyState({
  icon,
  title,
  hint,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-panel/40 px-6 py-14 text-center">
      {icon && <div className="text-muted-2">{icon}</div>}
      <div className="text-sm font-medium text-fg">{title}</div>
      {hint && <div className="max-w-sm text-sm text-muted">{hint}</div>}
      {action}
    </div>
  );
}
