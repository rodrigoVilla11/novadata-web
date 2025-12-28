"use client";

import React, { useEffect, useMemo, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/app/providers/AuthProvider";

type ProtectedProps = {
  children: React.ReactNode;
  /**
   * Si querés un loader custom (ej: tu <PageLoader />)
   */
  fallback?: React.ReactNode;
  /**
   * Si querés exigir roles para ver esta pantalla
   * Ej: ["ADMIN"] o ["ADMIN","MANAGER"]
   */
  requireRoles?: string[];
  /**
   * Si preferís que en vez de redirect te muestre un card "No autorizado"
   */
  noAccessFallback?: React.ReactNode;
};

function DefaultFallback() {
  return (
    <div className="min-h-[40vh] w-full flex items-center justify-center">
      <div className="rounded-2xl border border-zinc-200 bg-white px-5 py-4 text-sm text-zinc-700 shadow-sm">
        Cargando sesión…
      </div>
    </div>
  );
}

function DefaultNoAccess() {
  return (
    <div className="min-h-[40vh] w-full flex items-center justify-center">
      <div className="max-w-md rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-700 shadow-sm">
        No autorizado.
      </div>
    </div>
  );
}

export function Protected({
  children,
  fallback,
  requireRoles,
  noAccessFallback,
}: ProtectedProps) {
  const { user, loading } = useAuth() as any;
  const router = useRouter();
  const pathname = usePathname();

  const redirectedRef = useRef(false);

  const hasRoleAccess = useMemo(() => {
    if (!requireRoles?.length) return true;
    const roles: string[] = user?.roles || [];
    return requireRoles.some((r) => roles.includes(r));
  }, [requireRoles, user]);

  useEffect(() => {
    // Evita loops / replaces múltiples
    if (redirectedRef.current) return;

    if (!loading && !user) {
      redirectedRef.current = true;

      // Guardamos a dónde quería ir para volver post-login
      const returnTo = encodeURIComponent(pathname || "/");
      router.replace(`/login?returnTo=${returnTo}`);
    }
  }, [loading, user, router, pathname]);

  if (loading) return <>{fallback ?? <DefaultFallback />}</>;

  // Si no hay user, ya disparamos redirect. Evitamos render.
  if (!user) return null;

  // Si exige roles y no cumple
  if (!hasRoleAccess) return <>{noAccessFallback ?? <DefaultNoAccess />}</>;

  return <>{children}</>;
}
