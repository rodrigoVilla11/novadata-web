"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./providers/AuthProvider";
import Image from "next/image";

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    if (user) {
      router.replace("/dashboard");
    } else {
      router.replace("/login");
    }
  }, [loading, user, router]);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0f2f26]">
      {/* Fondo sutil */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 -top-24 h-105 w-105 rounded-full bg-[#1b5a46]/35 blur-3xl" />
        <div className="absolute -bottom-24 -right-24 h-105 w-105 rounded-full bg-[#fbbf24]/10 blur-3xl" />
        <div className="absolute inset-0 bg-linear-to-b from-white/10 via-white/0 to-black/10" />
      </div>

      {/* Contenido */}
      <div className="relative flex flex-col items-center gap-6 text-center">
        {/* Logo */}
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#144336] ring-1 ring-white/20 shadow-lg">
          <Image
            src="/logo-white.svg"
            alt="Gourmetify"
            width={26}
            height={26}
            priority
          />
        </div>

        {/* Texto */}
        <div>
          <p className="text-sm font-medium text-white">
            Iniciando Gourmetify
          </p>
          <p className="mt-1 text-xs text-white/70">
            Preparando tu panel de trabajo
          </p>
        </div>

        {/* Loader sutil */}
        <div className="mt-2 flex items-center gap-2">
          <span className="h-2 w-2 animate-pulse rounded-full bg-white/70" />
          <span className="h-2 w-2 animate-pulse rounded-full bg-white/50 [animation-delay:150ms]" />
          <span className="h-2 w-2 animate-pulse rounded-full bg-white/30 [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}
