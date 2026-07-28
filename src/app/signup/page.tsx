"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const SignupClient = dynamic(() => import("./SignupClient"), {
  ssr: false,
});

export default function SignupPage() {
  return (
    <div className="tc-login-bg relative min-h-screen overflow-hidden tc-grain tc-typography">
      <div className="absolute top-6 left-6 z-20">
        <Link href="/login">
          <Button variant="ghost" className="text-sm font-semibold hover:bg-white/10 text-white/80 hover:text-white flex items-center gap-2 px-4 py-2 rounded-xl">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Button>
        </Link>
      </div>

      <div className="relative z-10 flex min-h-screen items-center justify-center p-4 pt-24 sm:pt-4">
        <SignupClient />
      </div>
    </div>
  );
}
