"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

type ToastItem = {
  id: string;
  title: string;
  message: string;
  link?: string;
};

export function RealtimeToast() {
  const [items, setItems] = React.useState<ToastItem[]>([]);
  const router = useRouter();

  function showToast(item: ToastItem) {
    setItems((prev) => [...prev, item]);

    setTimeout(() => {
      setItems((prev) => prev.filter((i) => i.id !== item.id));
    }, 5000);
  }

  // 🔥 expõe global (simples e eficiente)
  (globalThis as any).__showRealtimeToast = showToast;

  return (
    <div className="fixed top-4 right-4 z-[2147483647] flex flex-col gap-2">
      {items.map((t) => (
        <div
          key={t.id}
          className="w-[320px] rounded-xl border border-white/10 bg-black/70 backdrop-blur-xl p-4 shadow-xl animate-in slide-in-from-right-2"
        >
          <div className="text-sm font-semibold text-white">{t.title}</div>
          <div className="text-xs text-white/70 mt-1">{t.message}</div>

          {t.link && (
            <button
              onClick={() => t.link && router.push(t.link)}
              className="mt-2 text-xs text-[#00d0e6] hover:underline"
            >
              Ver agora
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
