"use client";

/**
 * E.3.0 — CAMERA SCANNER COMPONENT.
 *
 * Usa BarcodeDetector API (nativa) com fallback documentado.
 * Suporta: QR_CODE, CODE_128, EAN_13, EAN_8.
 * Debounce: trava após detecção para evitar múltiplas leituras do mesmo código.
 */

import React, { useRef, useEffect, useCallback, useState } from "react";

export type CameraStatus =
  | "INITIALIZING"
  | "READY"
  | "DETECTED"
  | "PROCESSING"
  | "ERROR"
  | "PERMISSION_DENIED"
  | "NO_CAMERA";

export interface CameraScanResult {
  code: string;
  format?: string;
  scannedAt: string;
}

interface CameraScannerProps {
  onScan: (result: CameraScanResult) => void;
  enabled?: boolean;
  /** ms de debounce entre detecções. */
  debounceMs?: number;
}

export const CameraScanner: React.FC<CameraScannerProps> = ({
  onScan,
  enabled = true,
  debounceMs = 3000,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  const [status, setStatus] = useState<CameraStatus>("INITIALIZING");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const lastScanRef = useRef<number>(0);
  const lastCodeRef = useRef<string>("");
  const animFrameRef = useRef<number>(0);

  const stopCamera = useCallback(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    lastCodeRef.current = "";
  }, []);

  const detectBarcode = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video.readyState < 2) {
      animFrameRef.current = requestAnimationFrame(detectBarcode);
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);

    try {
      // BarcodeDetector API (Chrome 83+)
      if ("BarcodeDetector" in window) {
        const formats = ["qr_code", "code_128", "ean_13", "ean_8", "code_39"] as any[];
        const detector = new (window as any).BarcodeDetector({ formats });
        const barcodes = await detector.detect(canvas);

        if (barcodes.length > 0) {
          const code = barcodes[0].rawValue;
          const now = Date.now();

          // Debounce: mesmo código nos últimos debounceMs? Ignora
          if (code === lastCodeRef.current && now - lastScanRef.current < debounceMs) {
            animFrameRef.current = requestAnimationFrame(detectBarcode);
            return;
          }

          lastScanRef.current = now;
          lastCodeRef.current = code;
          setStatus("DETECTED");

          onScanRef.current({
            code,
            format: barcodes[0].format,
            scannedAt: new Date().toISOString(),
          });

          setStatus("PROCESSING");
          // Não continua escaneando — caller decide quando reativar
          return;
        }
      }
    } catch {
      // BarcodeDetector falhou — fallback: apenas frame capture (OCR path)
      // A leitura real de código fica para USB HID ou digitação manual
    }

    animFrameRef.current = requestAnimationFrame(detectBarcode);
  }, [debounceMs]);

  const startCamera = useCallback(async () => {
    if (!enabled) return;
    setStatus("INITIALIZING");

    try {
      if (!navigator?.mediaDevices?.getUserMedia) {
        setStatus("NO_CAMERA");
        setErrorMsg("Câmera não disponível neste dispositivo.");
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setStatus("READY");
      detectBarcode();
    } catch (err: any) {
      const msg = String(err?.message || err);
      if (msg.includes("Permission") || msg.includes("NotAllowed")) {
        setStatus("PERMISSION_DENIED");
        setErrorMsg("Permissão de câmera negada.");
      } else {
        setStatus("ERROR");
        setErrorMsg(msg);
      }
    }
  }, [enabled, detectBarcode]);

  const resetScanner = useCallback(() => {
    lastCodeRef.current = "";
    lastScanRef.current = 0;
    if (enabled && streamRef.current) {
      setStatus("READY");
      detectBarcode();
    }
  }, [enabled, detectBarcode]);

  useEffect(() => {
    if (enabled) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [enabled, startCamera, stopCamera]);

  const statusLabel: Record<CameraStatus, string> = {
    INITIALIZING: "Iniciando câmera...",
    READY: "Aponte para o código",
    DETECTED: "Código detectado!",
    PROCESSING: "Processando...",
    ERROR: `Erro: ${errorMsg || "Falha na câmera"}`,
    PERMISSION_DENIED: "Permissão de câmera negada",
    NO_CAMERA: "Câmera indisponível",
  };

  return (
    <div className="relative w-full" style={{ minHeight: 120 }}>
      {status === "READY" || status === "DETECTED" || status === "PROCESSING" ? (
        <>
          <video ref={videoRef} className="w-full rounded-lg" playsInline muted autoPlay />
          <canvas ref={canvasRef} className="hidden" />
          {status === "READY" && (
            <div className="absolute inset-0 border-2 border-dashed border-[#00D0E6]/50 rounded-lg pointer-events-none">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3/4 h-16 border-2 border-[#00D0E6]/70 rounded" />
            </div>
          )}
        </>
      ) : (
        <div className="flex items-center justify-center h-24 bg-slate-100 rounded-lg text-sm text-slate-500">
          {statusLabel[status]}
        </div>
      )}
      <div className="text-xs text-center mt-1 text-slate-400">
        {statusLabel[status]}
      </div>
    </div>
  );
};

// Hook para expor resetScanner para o componente pai
export function useCameraScannerRef() {
  const scannerRef = useRef<{ resetScanner: () => void } | null>(null);
  return scannerRef;
}
