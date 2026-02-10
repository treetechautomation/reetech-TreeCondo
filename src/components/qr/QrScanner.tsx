"use client";

import dynamic from "next/dynamic";

type Props = {
  onResult?: (text: string) => void;
  onError?: (e: any) => void;
};

const QrScannerClient = dynamic(
  () => import("./QrScanner.client"),
  { ssr: false }
);

export default function QrScanner(props: Props) {
  return (
    <QrScannerClient
      onDecoded={(text: string) => props.onResult?.(text)}
      onError={props.onError}
    />
  );
}
