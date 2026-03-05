"use client";

import * as React from "react";

type Props = {
  /** novo */
  onScan?: (text: string) => void;
  /** compat (legado) */
  onDecoded?: (text: string) => void;

  /** msg amigável */
  onError?: (msg: string) => void;

  className?: string;
  fps?: number;
  qrbox?: number;

  /** UX */
  vibrate?: boolean;     // vibra quando ler
  autoStop?: boolean;    // para/limpa ao ler (evita duplicar)
};

async function safeStopHtml5(scanner: any) {
  if (!scanner) return;
  try {
    const st = typeof scanner.getState === "function" ? scanner.getState() : null;
    if (st === null || st === 2 || st === "SCANNING") {
      if (typeof scanner.stop === "function") await scanner.stop();
    } else {
      if (typeof scanner.stop === "function") await scanner.stop().catch(() => {});
    }
  } catch {}
  try {
    if (typeof scanner.clear === "function") await scanner.clear();
  } catch {}
}

function normalizeErr(e: any) {
  const name = e?.name ? String(e.name) : "";
  const msg = e?.message ? String(e.message) : String(e || "");
  const combo = name ? `${name}: ${msg}` : msg;

  // mensagens mais humanas
  if (/NotAllowedError|PermissionDenied/i.test(name) || /permission/i.test(msg)) {
    return "Permissão de câmera negada. Autorize a câmera nas configurações do navegador.";
  }
  if (/NotFoundError/i.test(name) || /Requested device not found/i.test(msg)) {
    return "Nenhuma câmera encontrada neste dispositivo.";
  }
  if (/NotReadableError/i.test(name) || /could not start video source/i.test(msg)) {
    return "A câmera está em uso por outro app (ou falhou ao iniciar). Feche outros apps e tente novamente.";
  }
  if (/OverconstrainedError/i.test(name)) {
    return "Não foi possível selecionar a câmera traseira automaticamente.";
  }
  if (/HTTPS|secure context/i.test(msg)) {
    return "A câmera exige HTTPS (secure context).";
  }

  return combo;
}

function pickBestCamera(cams: Array<{ id: string; label?: string }>) {
  if (!cams?.length) return null;
  const score = (label = "") => {
    const s = label.toLowerCase();
    let pts = 0;
    if (s.includes("back") || s.includes("rear")) pts += 5;
    if (s.includes("trase") || s.includes("trás") || s.includes("ambiente")) pts += 5;
    if (s.includes("wide") || s.includes("ultra")) pts += 2;
    if (s.includes("front") || s.includes("frontal")) pts -= 3;
    return pts;
  };
  const sorted = [...cams].sort((a, b) => score(b.label || "") - score(a.label || ""));
  return sorted[0] || cams[cams.length - 1];
}

export default function QrScannerClient({
  onDecoded,
  onScan,
  onError,
  className,
  fps = 12,
  qrbox = 250,
  vibrate = true,
  autoStop = true,
}: Props) {
  const idRef = React.useRef<string>("qr-reader-" + Math.random().toString(36).slice(2));
  const scannerRef = React.useRef<any>(null);
  const scannedRef = React.useRef(false);

  const [err, setErr] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<string>("");

  React.useEffect(() => {
    let cancelled = false;

    const fail = (msg: string) => {
      if (cancelled) return;
      setErr(msg);
      try { onError?.(msg); } catch {}
      console.warn("[QrScanner]", msg);
    };

    const okStatus = (msg: string) => {
      if (cancelled) return;
      setStatus(msg);
    };

    (async () => {
      try {
        // SSR guard
        if (typeof window === "undefined") return;

        // DOM guard
        const el = document.getElementById(idRef.current);
        if (!el) {
          // aguarda 1 tick caso o modal esteja montando
          await new Promise((r) => setTimeout(r, 0));
          const el2 = document.getElementById(idRef.current);
          if (!el2) return fail("Scanner: elemento DOM não encontrado (race).");
        }

        // suporte
        if (!("mediaDevices" in navigator) || !navigator.mediaDevices?.getUserMedia) {
          return fail("Seu navegador não suporta câmera (mediaDevices).");
        }

        // secure context
        if ((window as any).isSecureContext === false) {
          return fail("A câmera exige HTTPS (secure context).");
        }

        setErr(null);
        scannedRef.current = false;
        okStatus("Inicializando câmera...");

        const mod: any = await import("html5-qrcode");
        const Html5Qrcode = mod?.Html5Qrcode || mod?.default?.Html5Qrcode;
        if (!Html5Qrcode) return fail("html5-qrcode não carregou (Html5Qrcode ausente).");

        if (cancelled) return;

        const scanner = new Html5Qrcode(idRef.current);
        scannerRef.current = scanner;

        const onSuccess = async (decodedText: string) => {
          if (cancelled) return;
          const t = String(decodedText || "").trim();
          if (!t) return;

          // evita duplicar leitura
          if (scannedRef.current) return;
          scannedRef.current = true;

          try {
            if (vibrate && typeof navigator !== "undefined" && (navigator as any).vibrate) {
              (navigator as any).vibrate(30);
            }
          } catch {}

          try { onScan?.(t); } catch {}
          try { onDecoded?.(t); } catch {}

          okStatus("Lido ✅");

          if (autoStop) {
            try { await safeStopHtml5(scannerRef.current); } catch {}
            scannerRef.current = null;
          }
        };

        const cfg = { fps, qrbox };

        // 1) tenta traseira por facingMode
        try {
          okStatus("Abrindo câmera traseira...");
          await scanner.start({ facingMode: "environment" }, cfg, onSuccess, () => {});
          okStatus("Câmera ativa");
          return;
        } catch (e1: any) {
          // 2) fallback: listar câmeras e escolher a melhor
          try {
            okStatus("Buscando câmeras disponíveis...");
            const getCameras = mod?.Html5Qrcode?.getCameras || Html5Qrcode?.getCameras;
            if (typeof getCameras === "function") {
              const cams = await getCameras();
              const best = pickBestCamera(cams || []);
              if (best?.id) {
                okStatus(best?.label ? `Usando: ${best.label}` : "Selecionando câmera...");
                await scanner.start({ deviceId: { exact: best.id } }, cfg, onSuccess, () => {});
                okStatus("Câmera ativa");
                return;
              }
            }
          } catch (e2: any) {
            // ignora e cai no fail final abaixo
            console.warn("[QrScanner] fallback cameras failed:", e2);
          }

          return fail(normalizeErr(e1));
        }
      } catch (e: any) {
        return fail(normalizeErr(e));
      }
    })();

    return () => {
      cancelled = true;
      (async () => {
        try { await safeStopHtml5(scannerRef.current); } catch {}
        scannerRef.current = null;
      })();
    };
  }, [onScan, onDecoded, onError, fps, qrbox, vibrate, autoStop]);

  return (
    <div className={className}>
      {err ? (
        <div className="rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-red-100">
          <div className="font-semibold">Não foi possível abrir a câmera.</div>
          <div className="opacity-90">{err}</div>
          <div className="mt-2 text-xs opacity-80">
            Dica: no desktop sem webcam isso é normal. Teste no celular ou conecte uma câmera.
          </div>
        </div>
      ) : (
        <div className="text-xs text-white/60 mb-2">{status}</div>
      )}

      <div id={idRef.current} className="w-full" />
    </div>
  );
}
