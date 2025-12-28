"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { AdminProtected } from "@/components/AdminProtected";
import { useAuth } from "@/app/providers/AuthProvider";
import {
  LogOut,
  Menu,
  X,
  ClipboardList,
  Package,
  Factory,
  CalendarDays,
  ArrowLeft,
} from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  icon: React.ElementType;
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

export default function ManagerShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const router = useRouter();

  const roles = (user?.roles ?? []).map((r: string) => String(r).toUpperCase());

  const nav: NavItem[] = [
    { href: "/manager", label: "Panel", icon: CalendarDays },
    { href: "/manager/weekly", label: "Weekly", icon: ClipboardList },
    { href: "/manager/attendance", label: "Asistencia", icon: ClipboardList },
    { href: "/manager/stock", label: "Stock", icon: Package },
    { href: "/manager/production", label: "Producción", icon: Factory },
  ];

  const Sidebar = (
    <aside className="flex h-full w-[260px] flex-col bg-[#0f2f26] text-white">
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
          <div className="text-sm font-semibold tracking-wide">GOURMETIFY</div>
          <div className="text-xs text-white/70">Panel manager</div>
        </div>
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
              (item.href !== "/manager" && pathname.startsWith(item.href));

            const Icon = item.icon;

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
                <span className="inline-flex items-center gap-2">
                  <Icon className="h-4 w-4 opacity-90" />
                  {item.label}
                </span>
                {active && <span className="text-xs opacity-70">●</span>}
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
    </aside>
  );

  return (
    <AdminProtected allow={["ADMIN", "MANAGER"]}>
      <div className="flex h-screen bg-gradient-to-b from-zinc-50 to-zinc-100">
        {/* Sidebar desktop */}
        <div className="hidden md:block">{Sidebar}</div>

        {/* Mobile top bar */}
        <div className="md:hidden fixed top-0 left-0 right-0 z-30 border-b border-zinc-200 bg-white/85 backdrop-blur">
          <div className="px-4 py-3 flex items-center justify-between">
            <button
              onClick={() => setMobileOpen(true)}
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 hover:bg-zinc-50"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#0f2f26]">
                <Image
                  src="/logo-white.svg"
                  alt="Gourmetify"
                  width={18}
                  height={18}
                />
              </div>
              <div className="text-sm font-semibold text-zinc-900">Manager</div>
            </div>
          </div>
        </div>

        {/* Mobile drawer */}
        {mobileOpen && (
          <div className="md:hidden fixed inset-0 z-40">
            <button
              className="absolute inset-0 bg-black/40"
              onClick={() => setMobileOpen(false)}
            />
            <div className="absolute left-0 top-0 h-full w-[280px] bg-[#0f2f26]">
              <div className="flex justify-end p-3">
                <button
                  onClick={() => setMobileOpen(false)}
                  className="rounded-xl bg-white/10 p-2"
                >
                  <X className="h-5 w-5 text-white" />
                </button>
              </div>
              {Sidebar}
            </div>
          </div>
        )}

        {/* Main */}
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
