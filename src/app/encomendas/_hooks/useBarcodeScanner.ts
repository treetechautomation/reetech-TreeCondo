"use client";

/**
 * E.2.1 — HOOK USB HID BARCODE SCANNER.
 *
 * Detecta leitores de código de barras USB HID que funcionam como teclado.
 *
 * Princípio: leitores HID enviam caracteres muito rápido (~1-5ms entre chars)
 * seguidos de Enter. Digitação humana tem intervalos ~100-500ms.
 *
 * Parâmetros configuráveis:
 *   MAX_INTERVAL_MS   — intervalo máximo entre caracteres para ser considerado scan
 *   MIN_LENGTH         — tamanho mínimo do código
 *   BUFFER_TIMEOUT_MS  — timeout para limpar buffer parcial
 */

import { useEffect, useCallback, useRef } from "react";

const MAX_INTERVAL_MS = 50;
const MIN_LENGTH = 6;
const BUFFER_TIMEOUT_MS = 200;

export interface BarcodeScan {
  code: string;
  source: "USB_HID";
  scannedAt: string;
}

interface UseBarcodeScannerOptions {
  onScan: (scan: BarcodeScan) => void;
  enabled?: boolean;
  /** Se true, ignora eventos quando o foco está em input/textarea. */
  ignoreWhenFocused?: boolean;
}

export function useBarcodeScanner({
  onScan,
  enabled = true,
  ignoreWhenFocused = true,
}: UseBarcodeScannerOptions) {
  const bufferRef = useRef<string>("");
  const lastKeyTimeRef = useRef<number>(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  const clearBuffer = useCallback(() => {
    bufferRef.current = "";
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignorar quando foco está em campo editável (digitação humana)
      if (ignoreWhenFocused) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      }

      const now = Date.now();
      const interval = now - lastKeyTimeRef.current;

      // Enter → fim do scan
      if (e.key === "Enter") {
        if (bufferRef.current.length >= MIN_LENGTH) {
          const code = bufferRef.current;
          onScanRef.current({
            code,
            source: "USB_HID",
            scannedAt: new Date().toISOString(),
          });
        }
        clearBuffer();
        return;
      }

      // Se intervalo muito longo → digitação humana, reset
      if (interval > MAX_INTERVAL_MS && bufferRef.current.length > 0) {
        clearBuffer();
      }

      // Apenas caracteres imprimíveis (não teclas especiais)
      if (e.key.length === 1) {
        if (bufferRef.current.length === 0) {
          lastKeyTimeRef.current = now;
        }
        bufferRef.current += e.key;
        lastKeyTimeRef.current = now;

        // Timeout: se ficar muito tempo sem Enter, limpa buffer
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
          if (bufferRef.current.length > 0 && bufferRef.current.length < MIN_LENGTH) {
            clearBuffer();
          }
        }, BUFFER_TIMEOUT_MS);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enabled, ignoreWhenFocused, clearBuffer]);

  return { clearBuffer };
}
