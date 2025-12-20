"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AdminProtected } from "@/components/AdminProtected";
import { useAuth } from "@/app/providers/AuthProvider";

type NavItem = {
  href: string;
  label: string;
  roles?: string[]; // si no está, se muestra a cualquiera con acceso admin shell
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
  const { user, logout } = useAuth();

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
      <div className="min-h-screen bg-zinc-50">
        <div className="mx-auto max-w-7xl px-4 py-6">
          <div className="grid gap-6 md:grid-cols-[260px_1fr]">
            {/* Sidebar */}
            <aside className="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
              <div className="border-b border-zinc-100 p-5">
                <div className="text-sm font-semibold text-zinc-900">Panel Admin</div>
                <div className="mt-1 text-xs text-zinc-500">
                  {user?.email ?? "—"}{" "}
                  {roles.length ? `• ${roles.join(", ")}` : ""}
                </div>
              </div>

              <nav className="p-2">
                {nav
                  .filter((item) => hasAnyRole(roles, item.roles))
                  .map((item) => {
                    const active =
                      pathname === item.href ||
                      (item.href !== "/admin" && pathname.startsWith(item.href));

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cx(
                          "flex items-center justify-between rounded-xl px-3 py-2 text-sm font-medium transition",
                          active
                            ? "bg-zinc-900 text-white"
                            : "text-zinc-700 hover:bg-zinc-50"
                        )}
                      >
                        <span>{item.label}</span>
                        {active && (
                          <span className="text-xs opacity-80">●</span>
                        )}
                      </Link>
                    );
                  })}
              </nav>

              <div className="border-t border-zinc-100 p-4">
                <button
                  onClick={logout}
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
                >
                  Cerrar sesión
                </button>
              </div>
            </aside>

            {/* Main */}
            <main className="min-w-0">
              <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
                <div className="border-b border-zinc-100 px-5 py-4">
                  <div className="text-sm text-zinc-500">
                    {pathname}
                  </div>
                </div>
                <div className="p-5">{children}</div>
              </div>
            </main>
          </div>
        </div>
      </div>
    </AdminProtected>
  );
}
