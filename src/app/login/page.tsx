"use client";

import dynamic from "next/dynamic";
import Loading from "./loading";

const LoginClient = dynamic(() => import("./LoginClient"), {
  ssr: false,
  loading: () => <Loading />,
});

export default function LoginPage() {
  return <LoginClient />;
}
