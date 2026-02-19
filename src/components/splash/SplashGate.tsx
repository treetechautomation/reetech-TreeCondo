"use client";

import * as React from "react";
import SplashScreen from "./SplashScreen";

const KEY = "tc_splash_done_v1";

export default function SplashGate() {
  const [show, setShow] = React.useState(false);

  React.useEffect(() => {
    try {
      const already = sessionStorage.getItem(KEY);
      if (already) return;

      setShow(true);

      const prevOverflow = document.documentElement.style.overflow;
      document.documentElement.style.overflow = "hidden";

      const t = window.setTimeout(() => {
        sessionStorage.setItem(KEY, "1");
        setShow(false);
        document.documentElement.style.overflow = prevOverflow;
      }, 1200);

      return () => {
        window.clearTimeout(t);
        document.documentElement.style.overflow = prevOverflow;
      };
    } catch {
      setShow(true);
      const t = window.setTimeout(() => setShow(false), 1200);
      return () => window.clearTimeout(t);
    }
  }, []);

  if (!show) return null;
  return <SplashScreen />;
}
