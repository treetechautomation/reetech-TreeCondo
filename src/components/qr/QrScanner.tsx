"use client";

import * as React from "react";

type Props = {
  onResult: (text: string) => void;
  onError?: (err: any) => void;
  className?: string;
};

export default function QrScanner({ onResult, onError, className }: Props) {
  const regionId = React.useId().replace(/:/g, "_");
  const scannerRef = React.useRef<any>(null);

  React.useEffect(() => {
    let active = true;

    (async () => {
      try {
        const mod = await import("html5-qrcode");
        if (!active) return;

        const { Html5Qrcode } = mod as any;
        const qr = new Html5Qrcode(regionId);
        scannerRef.current = qr;

        await qr.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 260, height: 260 } },
          (decodedText: string) => onResult(decodedText),
          (err: any) => onError?.(err)
        );
      } catch (e) {
        onError?.(e);
      }
    })();

    return () => {
      active = false;
      (async () => {
        try {
          const qr = scannerRef.current;
          if (qr) {
            await qr.stop();
            await qr.clear();
          }
        } catch {
          // ignore
        }
      })();
    };
  }, [regionId, onResult, onError]);

  return (
    <div className={className}>
      <div id={regionId} />
      <div className="mt-2 text-xs text-muted-foreground">
        Se não abrir a câmera, verifique a permissão do navegador.
      </div>
    </div>
  );
}
