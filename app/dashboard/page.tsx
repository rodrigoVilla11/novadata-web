"use client";

import React, { useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { Protected } from "@/components/Protected";
import { useAuth } from "@/app/providers/AuthProvider";

function hasRole(user: any, role: string) {
  return Array.isArray(user?.roles) && user.roles.includes(role);
}

function getHomeByRole(user: any) {
  const isAdmin = hasRole(user, "ADMIN");
  const isManager = hasRole(user, "MANAGER");
  const isCashier = hasRole(user, "CASHIER");

  if (isAdmin) return "/admin";
  if (isManager) return "/manager";
  if (isCashier) return "/cashier";
  return "/user";
}

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-zinc-100 animate-pulse" />
          <div className="min-w-0">
            <div className="h-4 w-44 rounded bg-zinc-100 animate-pulse" />
            <div className="mt-2 h-3 w-28 rounded bg-zinc-100 animate-pulse" />
          </div>
        </div>

        <div className="mt-5 space-y-2">
          <div className="h-3 w-full rounded bg-zinc-100 animate-pulse" />
          <div className="h-3 w-5/6 rounded bg-zinc-100 animate-pulse" />
          <div className="h-3 w-2/3 rounded bg-zinc-100 animate-pulse" />
        </div>

        <div className="mt-5 text-xs text-zinc-500">
          Redirigiendo al panel…
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useAuth() as any;

  const home = useMemo(() => (user ? getHomeByRole(user) : null), [user]);

  // evita múltiples replaces
  const redirectedRef = useRef(false);

  useEffect(() => {
    if (!user) return;
    if (!home) return;
    if (redirectedRef.current) return;

    redirectedRef.current = true;
    router.replace(home);
  }, [user, home, router]);

  return (
    <Protected fallback={<LoadingScreen />}>
      <LoadingScreen />
    </Protected>
  );
}
