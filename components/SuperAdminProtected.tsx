"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/providers/AuthProvider";

function hasSuperAdmin(user: any) {
  const roles: string[] = Array.isArray(user?.roles)
    ? user.roles
    : user?.role
      ? [user.role]
      : [];
  return roles.includes("SUPERADMIN");
}

export function SuperAdminProtected({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, loading } = useAuth() as any;

  if (loading) return null;

  if (!user || !hasSuperAdmin(user)) {
    router.replace("/");
    return null;
  }

  return <>{children}</>;
}
