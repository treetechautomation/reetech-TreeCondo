"use client";

import * as React from "react";
import { useBranding } from "@/contexts/BrandingContext";

type Props = {
  durationMs?: number;
};

const KEY = "tc_boot_done_v4";

export default function BootSplash({ durationMs = 1200 }: Props) {
  const { menuLogoUrl } = useBranding();

  const [show, setShow] = React.useState(false);
  const [leaving, setLeaving] = React.useState(false);

  React.useEffect(() => {
    try {
      const done = sessionStorage.getItem(KEY);
      if (done) return;

      setShow(true);

      const t1 = window.setTimeout(() => setLeaving(true), Math.max(300, durationMs - 220));
      const t2 = window.setTimeout(() => {
        sessionStorage.setItem(KEY, "1");
        setShow(false);
      }, durationMs);

      return () => {
        window.clearTimeout(t1);
        window.clearTimeout(t2);
      };
    } catch {
      setShow(false);
    }
  }, [durationMs]);

  if (!show) return null;

  const logo = menuLogoUrl || "/branding-fallback/logo-menu.jpeg";

  return (
    <div className={`tc-splash fixed inset-0 z-[9999] ${leaving ? "tc-splash--out" : ""}`}>
      <div className="tc-splash__bg" />
      <div className="tc-splash__veil" />

      <div className="relative flex h-full w-full items-center justify-center px-6">
        <div className="tc-splash__card w-full max-w-md">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="tc-splash__logoWrap">
              <img src={logo} alt="TreeCondo" className="tc-splash__logo" />
            </div>

            <div>
              <div className="tc-splash__title">TreeCondo</div>
              <div className="tc-splash__subtitle">Iniciando seu painel…</div>
            </div>

            <div className="tc-splash__bar">
              <div className="tc-splash__barFill" />
            </div>

            <div className="tc-splash__hint">Carregando módulos essenciais</div>
          </div>
        </div>
      </div>
    </div>
  );
}
