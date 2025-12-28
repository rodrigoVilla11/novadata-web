"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useAuth } from "@/app/providers/AuthProvider";
import { Menu, X, LogOut } from "lucide-react";

type NavItem = {
  href: string;
  label: string;
};

function cx(...cls: Array<string | false | null | undefined>) {
  return cls.filter(Boolean).join(" ");
}

export default function CashierShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);

  const nav: NavItem[] = [
    { href: "/cashier", label: "Dashboard" },
    { href: "/cashier/incomes", label: "Ingresos" },
    { href: "/cashier/expenses", label: "Gastos" },
    { href: "/cashier/closing", label: "Cierre del día" },
  ];

  return (
    <div className="flex h-screen bg-gradient-to-b from-zinc-50 to-zinc-100">
      {/* ================= MOBILE OVERLAY ================= */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* ================= SIDEBAR ================= */}
      <aside
        className={cx(
          "fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col bg-[#0f2f26] text-white transition-transform md:static md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
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
            <div className="text-xs text-white/70">Cashier</div>
          </div>
        </div>

        {/* User */}
        <div className="px-5 py-4 border-b border-white/10">
          <div className="text-xs text-white/70 truncate">
            {user?.email ?? "—"}
          </div>
          <div className="mt-1">
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold">
              CASHIER
            </span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {nav.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/cashier" &&
                pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
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
            onClick={async () => {
              await logout();
              window.location.href = "/login";
            }}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-sm font-semibold text-white hover:bg-white/20 transition"
          >
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* ================= MAIN ================= */}
      <div className="flex-1 min-w-0 overflow-y-auto">
        {/* Mobile top bar */}
        <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-zinc-200 bg-white px-4 py-3 md:hidden">
          <button
            onClick={() => setOpen((v) => !v)}
            className="rounded-lg border border-zinc-200 p-2"
          >
            {open ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </button>

          <div className="text-sm font-semibold text-zinc-900">
            Cashier
          </div>
        </div>

        {/* Content */}
        <main className="mx-auto max-w-7xl px-6 py-6">
          {children}
        </main>
      </div>
    </div>
  );
}
