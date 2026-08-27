import * as React from "react";

export function EmptyCard({
  title = "Nenhum dado disponível",
  description,
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-white/10 py-10 text-center">
      <p className="text-sm font-medium text-white/50">{title}</p>
      {description && <p className="text-xs text-white/30">{description}</p>}
    </div>
  );
}
