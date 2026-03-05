"use client";

import dynamic from "next/dynamic";

type Props = {
  onResult?: (text: string) => void;
  onError?: (msg: string) => void;
  className?: string;
  fps?: number;
  qrbox?: number;
};

const QrScannerClient = dynamic(() => import("./QrScanner.client"), { ssr: false });

export default function QrScanner(props: Props) {
  return (
    <QrScannerClient
      className={props.className}
      fps={props.fps}
      qrbox={props.qrbox}
      // novo (preferido)
      onScan={(text: string) => props.onResult?.(text)}
      // legado (compat)
      onDecoded={(text: string) => props.onResult?.(text)}
      // sempre string agora
      onError={(msg: string) => props.onError?.(msg)}
    />
  );
}
