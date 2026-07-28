"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function MoradoresRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/cadastros/pessoas");
  }, [router]);

  return null;
}
