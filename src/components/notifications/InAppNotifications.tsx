"use client";

import * as React from "react";
import { useInAppNotifications } from "@/hooks/useInAppNotifications";
import { unlockNotificationAudio } from "@/lib/notifyBeep";

export default function InAppNotifications() {
  useInAppNotifications();

  React.useEffect(() => {
    const onFirst = () => unlockNotificationAudio();
    window.addEventListener("pointerdown", onFirst, { once: true });
    return () => window.removeEventListener("pointerdown", onFirst);
  }, []);

  return null;
}
