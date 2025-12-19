"use client";

import { useAuth } from "@/app/providers/AuthProvider";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function AdminProtected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) return router.replace("/login");
    if (!user.roles?.includes("ADMIN")) router.replace("/dashboard");
  }, [loading, user, router]);

  if (loading) return <div style={{ padding: 24 }}>Cargando sesión...</div>;
  if (!user) return null;
  if (!user.roles?.includes("ADMIN")) return null;

  return <>{children}</>;
}
