"use client";

import { useEffect, useState } from "react";
import { UserNav } from "@/components/user-nav";

export function UserNavClient() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  return isClient ? <UserNav /> : null;
}
