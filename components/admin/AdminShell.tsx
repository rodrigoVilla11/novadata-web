"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { AdminProtected } from "@/components/AdminProtected";
import { useAuth } from "@/app/providers/AuthProvider";
import {
  LogOut,
  ArrowLeft,
  Menu,
  X,
} from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  roles?: string[];
};

function cx(...cls: Array<string | false | null | undefined>) {
  return cls.filter(Boolean).join(" ");
}

function hasAnyRole(userRoles: string[] | undefined, allowed?: string[]) {
  if (!allowed || allowed.length === 0) return true;
  const set = new Set((userRoles ?? []).map((r) => r.toUpperCase()));
  return allowed.some((r) => set.has(r.toUpperCase()));
}

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  const [mobileOpen, setMobileOpen] = useState(false);

  const roles = (user?.roles ?? []).map((r: string) => String(r).toUpperCase());

  const nav: NavItem[] = [
    { href: "/admin", label: "Dashboard", roles: ["ADMIN", "MANAGER"] },
    { href: "/admin/users", label: "Usuarios", roles: ["ADMIN"] },
    { href: "/admin/employees", label: "Empleados", roles: ["ADMIN"] },
    { href: "/admin/products", label: "Productos", roles: ["ADMIN"] },
    { href: "/admin/tasks", label: "Tareas", roles: ["ADMIN"] },
    { href: "/admin/suppliers", label: "Proveedores", roles: ["ADMIN"] },
    { href: "/admin/attendance", label: "Asistencia", roles: ["ADMIN"] },
  ];

  return (
    <AdminProtected>
      <div className="flex h-screen bg-gradient-to-b from-zinc-50 to-zinc-100 overflow-hidden">
        {/* ===================== */}
        {/* MOBILE OVERLAY */}
        {/* ===================== */}
        {mobileOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/40 md:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}

        {/* ===================== */}
        {/* SIDEBAR */}
        {/* ===================== */}
        <aside
          className={cx(
            "fixed inset-y-0 left-0 z-50 w-[260px] transform bg-[#0f2f26] text-white transition-transform md:static md:translate-x-0",
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="flex h-full flex-col">
            {/* Brand */}
            <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#144336] ring-1 ring-white/20">
                <Image
                  src="/logo-white.svg"
                  alt="Gourmetify"
                  width={22}
                  height={22}
                  priority
                />
              </div>

              <div className="leading-tight">
                <div className="text-sm font-semibold tracking-wide">
                  GOURMETIFY
                </div>
                <div className="text-xs text-white/70">
                  Panel administrativo
                </div>
              </div>

              {/* close mobile */}
              <button
                onClick={() => setMobileOpen(false)}
                className="ml-auto rounded-lg p-1 text-white/70 hover:bg-white/10 md:hidden"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* User */}
            <div className="px-5 py-4 border-b border-white/10">
              <div className="text-xs text-white/70 truncate">
                {user?.email ?? "—"}
              </div>
              {roles.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {roles.map((r) => (
                    <span
                      key={r}
                      className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold"
                    >
                      {r}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* NAV */}
            <nav className="flex-1 overflow-y-auto p-3 space-y-1">
              {nav
                .filter((item) => hasAnyRole(roles, item.roles))
                .map((item) => {
                  const active =
                    pathname === item.href ||
                    (item.href !== "/admin" &&
                      pathname.startsWith(item.href));

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={cx(
                        "flex items-center justify-between rounded-xl px-3 py-2 text-sm font-medium transition",
                        active
                          ? "bg-[#144336] text-white shadow-sm"
                          : "text-white/80 hover:bg-white/10 hover:text-white"
                      )}
                    >
                      <span>{item.label}</span>
                      {active && (
                        <span className="text-xs opacity-70">●</span>
                      )}
                    </Link>
                  );
                })}
            </nav>

            {/* Logout */}
            <div className="p-4 border-t border-white/10">
              <button
                onClick={logout}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-sm font-semibold text-white hover:bg-white/20 transition"
              >
                <LogOut className="h-4 w-4" />
                Cerrar sesión
              </button>
            </div>
          </div>
        </aside>

        {/* ===================== */}
        {/* MAIN */}
        {/* ===================== */}
        <div className="flex-1 min-w-0 overflow-y-auto">
          {/* Top bar (mobile + back) */}
          <div className="sticky top-0 z-30 flex items-center gap-2 border-b bg-white/80 backdrop-blur px-4 py-3 md:hidden">
            <button
              onClick={() => setMobileOpen(true)}
              className="rounded-lg border p-2 text-zinc-700"
            >
              <Menu className="h-4 w-4" />
            </button>

            <button
              onClick={() => router.back()}
              className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm text-zinc-700"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver
            </button>
          </div>

          {/* Content */}
          <main className="mx-auto max-w-7xl px-6 py-6">
            {/* Back button desktop */}
            <div className="mb-4 hidden md:flex">
              <button
                onClick={() => router.back()}
                className="flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
              >
                <ArrowLeft className="h-4 w-4" />
                Volver
              </button>
            </div>

            {children}
          </main>
        </div>
      </div>
    </AdminProtected>
  );
}
