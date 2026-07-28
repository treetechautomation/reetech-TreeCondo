"use client";

/**
 * UI.G2 — SectionCard
 * 
 * Standard card section for page composition.
 * Wraps shadcn Card with consistent styling.
 */
import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface SectionCardProps {
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
}

export function SectionCard({ title, description, actions, children, className, noPadding }: SectionCardProps) {
  return (
    <Card className={cn("rounded-2xl border-border bg-card shadow-sm", className)}>
      {(title || actions) && (
        <CardHeader className={cn("flex flex-row items-start justify-between gap-2", noPadding && "p-0")}>
          <div className="space-y-1">
            {title && <CardTitle>{title}</CardTitle>}
            {description && <CardDescription>{description}</CardDescription>}
          </div>
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </CardHeader>
      )}
      <CardContent className={cn(noPadding && "p-0", !title && !actions && "pt-6")}>
        {children}
      </CardContent>
    </Card>
  );
}
