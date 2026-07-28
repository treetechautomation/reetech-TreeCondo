"use client";

/**
 * UI.G2 — PageHeader
 * 
 * Standard page header with title, description, icon, and action buttons.
 */
import * as React from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, description, icon, actions, className }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6", className)}>
      <div className="flex items-start gap-3 min-w-0">
        {icon && <div className="shrink-0 mt-0.5">{icon}</div>}
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-semibold text-foreground truncate">{title}</h1>
          {description && (
            <p className="text-sm text-muted-foreground mt-1 max-w-prose">{description}</p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex items-center gap-2 shrink-0 sm:ml-auto">{actions}</div>
      )}
    </div>
  );
}
