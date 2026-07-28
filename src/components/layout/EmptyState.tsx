"use client";

/**
 * UI.G2 — EmptyState
 * 
 * Standard empty state display with icon, message, and optional CTA.
 */
import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { LucideIcon } from "lucide-react";

interface EmptyStateAction {
  label: string;
  onClick: () => void;
}

interface EmptyStateProps {
  icon?: LucideIcon | React.ReactNode;
  title?: string;
  description?: string;
  action?: EmptyStateAction | React.ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  const IconNode = icon
    ? React.isValidElement(icon)
      ? icon
      : React.createElement(icon as React.ElementType, { className: "h-8 w-8", "aria-hidden": true })
    : null;

  const isActionObj = (a: unknown): a is EmptyStateAction =>
    typeof a === "object" && a !== null && "label" in a && "onClick" in a;

  return (
    <div className={cn("flex flex-col items-center justify-center py-12 px-4 text-center", className)}>
      {IconNode && <div className="mb-4 text-muted-foreground">{IconNode}</div>}
      {title && <p className="text-sm font-medium text-foreground mb-1">{title}</p>}
      {description && <p className="text-sm text-muted-foreground max-w-md">{description}</p>}
      {action && (
        <div className="mt-4">
          {isActionObj(action) ? (
            <Button variant="outline" size="sm" onClick={action.onClick}>{action.label}</Button>
          ) : (
            action
          )}
        </div>
      )}
    </div>
  );
}
