import React from "react";
import type { Metadata } from "next";
import AdminShell from "@/components/admin/AdminShell";
import { AdminProtected } from "@/components/AdminProtected";

/**
 * Metadata del área Admin
 * Se concatena con el template global: "%s | Gourmetify"
 */
export const metadata: Metadata = {
  title: "Administración",
  description:
    "Panel de administración de Gourmetify para gestión operativa y control del negocio.",
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminProtected allow={["ADMIN", "MANAGER"]}>
      {/* Fondo global del área admin */}
      <div className="min-h-screen bg-linear-to-b from-zinc-50 to-zinc-100">
        {/* Shell (sidebar + header) */}
        <AdminShell>
          {/* Contenido */}
          <main className="mx-auto w-full max-w-7xl px-4 py-6">
            {children}
          </main>
        </AdminShell>
      </div>
    </AdminProtected>
  );
}
