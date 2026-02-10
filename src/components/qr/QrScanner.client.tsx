"use client";

import { useEffect } from "react";

type Props = {
  onDecoded: (text: string) => void;
  onError?: (e: any) => void;
};

export default function QrScannerClient({ onDecoded, onError }: Props) {
  useEffect(() => {
    let active = true;
    let scanner: any;

    (async () => {
      try {
        const mod: any = await import("html5-qrcode");
        if (!active) return;

        const { Html5Qrcode } = mod;
        scanner = new Html5Qrcode("qr-reader");

        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: 250 },
          (decodedText: string) => {
            onDecoded(decodedText);
          },
          (err: any) => {
            onError?.(err);
          }
        );
      } catch (e) {
        onError?.(e);
      }
    })();

    return () => {
      active = false;
      if (scanner) {
        scanner.stop().catch(() => {});
        scanner.clear?.();
      }
    };
  }, [onDecoded, onError]);

  return <div id="qr-reader" className="w-full" />;
}
