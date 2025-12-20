"use client";

import { useAuth } from "@/app/providers/AuthProvider";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

function hasAnyRole(userRoles: string[] | undefined, allowed: string[]) {
  const set = new Set((userRoles ?? []).map((r) => String(r).toUpperCase()));
  return allowed.some((r) => set.has(String(r).toUpperCase()));
}

export function AdminProtected({
  children,
  allow = ["ADMIN", "MANAGER"], // ✅ por defecto ambos
  redirectTo = "/dashboard",
}: {
  children: React.ReactNode;
  allow?: string[];
  redirectTo?: string;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) return router.replace("/login");
    if (!hasAnyRole(user.roles, allow)) router.replace(redirectTo);
  }, [loading, user, router, allow, redirectTo]);

  if (loading) return <div style={{ padding: 24 }}>Cargando sesión...</div>;
  if (!user) return null;
  if (!hasAnyRole(user.roles, allow)) return null;

  return <>{children}</>;
}
