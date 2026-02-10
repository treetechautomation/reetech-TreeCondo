"use client";

import dynamic from "next/dynamic";

type Props = {
  onResult?: (text: string) => void;
  onError?: (e: any) => void;
};

const QrScannerClient = dynamic(() => import("./QrScanner.client"), { ssr: false });

export default function QrScanner({ onResult, onError }: Props) {
  return (
    <QrScannerClient
      onDecoded={(text: string) => onResult?.(text)}
      onError={(e: any) => onError?.(e)}
    />
  );
}
