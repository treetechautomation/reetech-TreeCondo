"use client";

/**
 * UI.G2 — StatusBadge
 * 
 * Semantic status badge with tone-based coloring.
 * Uses design tokens (--success, --warning, --destructive, etc.)
 */
import * as React from "react";
import { cn } from "@/lib/utils";

type Tone = "success" | "warning" | "danger" | "info" | "neutral" | "accent";

interface StatusBadgeProps {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
}

const toneStyles: Record<Tone, string> = {
  success: "bg-success/10 text-success border-success/20",
  warning: "bg-warning/10 text-warning border-warning/20",
  danger: "bg-destructive/10 text-destructive border-destructive/20",
  info: "bg-info/10 text-info border-info/20",
  neutral: "bg-muted text-muted-foreground border-border",
  accent: "bg-primary/10 text-primary border-primary/20",
};

export function StatusBadge({ tone = "neutral", children, className }: StatusBadgeProps) {
  return (
    <span className={cn(
      "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
      toneStyles[tone],
      className
    )}>
      {children}
    </span>
  );
}
