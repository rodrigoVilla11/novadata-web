import React from "react";
import type { Metadata } from "next";
import { AdminProtected } from "@/components/AdminProtected";
import SuperAdminShell from "@/components/superAdmin/SuperAdminShell";

/**
 * Metadata del área SuperAdmin
 * Se concatena con el template global: "%s | Gourmetify"
 */
export const metadata: Metadata = {
  title: "SuperAdmin",
  description:
    "Panel SuperAdmin de Gourmetify para gestión global del sistema (planes, branches, settings globales).",
};

export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminProtected allow={["SUPERADMIN"]}>
      {/* Fondo global del área superadmin */}
      <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-zinc-100">
        {/* Shell (sidebar + header) */}
        <SuperAdminShell>
          {/* Contenido */}
          <main className="mx-auto w-full max-w-7xl px-4 py-6">
            {children}
          </main>
        </SuperAdminShell>
      </div>
    </AdminProtected>
  );
}
