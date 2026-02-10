"use client";

import { useEffect } from "react";

type Props = {
  onDecoded?: (text: string) => void;
  onError?: (e: any) => void;
};

export default function QrScannerClient({ onDecoded, onError }: Props) {
  useEffect(() => {
    let active = true;
    let qr: any = null;

    (async () => {
      const mod: any = await import("html5-qrcode");
      if (!active) return;

      const { Html5Qrcode } = mod;
      qr = new Html5Qrcode("qr-reader");

      await qr.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: 250 },
        (decodedText: string) => onDecoded?.(decodedText),
        (err: any) => onError?.(err)
      );
    })().catch((e) => onError?.(e));

    return () => {
      active = false;
      try {
        if (qr) qr.stop().catch(() => {});
      } catch {}
    };
  }, [onDecoded, onError]);

  return <div id="qr-reader" />;
}
