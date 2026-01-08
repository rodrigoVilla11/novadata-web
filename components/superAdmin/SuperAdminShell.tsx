"use client";

import React, { useEffect, useMemo, useState } from "react";
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
  ChevronDown,
  ChevronRight,
  Shield,
  Store,
  Sliders,
} from "lucide-react";

type NavLink = {
  type: "link";
  href: string;
  label: string;
  roles?: string[];
  icon?: React.ReactNode;
};

type NavGroup = {
  type: "group";
  id: string;
  label: string;
  roles?: string[];
  icon?: React.ReactNode;
  children: NavLink[];
};

type NavItem = NavLink | NavGroup;

function cx(...cls: Array<string | false | null | undefined>) {
  return cls.filter(Boolean).join(" ");
}

function hasAnyRole(userRoles: string[] | undefined, allowed?: string[]) {
  if (!allowed || allowed.length === 0) return true;
  const set = new Set((userRoles ?? []).map((r) => r.toUpperCase()));
  return allowed.some((r) => set.has(r.toUpperCase()));
}

function isActivePath(pathname: string, href: string) {
  if (href === "/superadmin") return pathname === "/superadmin";
  return (
    pathname === href ||
    pathname.startsWith(href + "/") ||
    pathname.startsWith(href)
  );
}

export default function SuperAdminShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth() as any;

  const [mobileOpen, setMobileOpen] = useState(false);
  const roles = (user?.roles ?? []).map((r: string) => String(r).toUpperCase());

  // ---------------- NAV ----------------
  const nav: NavItem[] = [
    {
      type: "link",
      href: "/superadmin",
      label: "Dashboard",
      roles: ["SUPERADMIN"],
      icon: <Shield className="h-4 w-4" />,
    },
    {
      type: "group",
      id: "system",
      label: "Sistema",
      roles: ["SUPERADMIN"],
      icon: <Sliders className="h-4 w-4" />,
      children: [
        {
          type: "link",
          href: "/superadmin/branches",
          label: "Branches",
          roles: ["SUPERADMIN"],
          icon: <Store className="h-4 w-4" />,
        },
        // Si más adelante querés reactivar settings, lo agregás acá
        // {
        //   type: "link",
        //   href: "/superadmin/settings",
        //   label: "Settings",
        //   roles: ["SUPERADMIN"],
        //   icon: <Sliders className="h-4 w-4" />,
        // },
      ],
    },
  ];

  // ---------------- open groups state ----------------
  const initialOpenGroups = useMemo(() => {
    const open: Record<string, boolean> = {};
    for (const item of nav) {
      if (item.type === "group") {
        const hasActiveChild = item.children.some((c) =>
          isActivePath(pathname, c.href)
        );
        open[item.id] = hasActiveChild;
      }
    }
    return open;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const [openGroups, setOpenGroups] =
    useState<Record<string, boolean>>(initialOpenGroups);

  // keep active group expanded when route changes
  useEffect(() => {
    setOpenGroups((prev) => {
      const next = { ...prev };
      for (const item of nav) {
        if (item.type !== "group") continue;
        const hasActiveChild = item.children.some((c) =>
          isActivePath(pathname, c.href)
        );
        if (hasActiveChild) next[item.id] = true;
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  function toggleGroup(id: string) {
    setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function onNavigate() {
    setMobileOpen(false);
  }

  // Filter items by role (groups hidden if no children visible)
  const visibleNav = useMemo(() => {
    const out: NavItem[] = [];

    for (const item of nav) {
      if (item.type === "link") {
        if (hasAnyRole(roles, item.roles)) out.push(item);
        continue;
      }

      if (!hasAnyRole(roles, item.roles)) continue;

      const children = item.children.filter((c) => hasAnyRole(roles, c.roles));
      if (children.length === 0) continue;

      out.push({ ...item, children });
    }

    return out;
  }, [nav, roles]);

  return (
    <AdminProtected allow={["SUPERADMIN"]}>
      <div className="flex h-screen bg-gradient-to-b from-zinc-50 to-zinc-100 overflow-hidden">
        {/* MOBILE OVERLAY */}
        {mobileOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/40 md:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}

        {/* SIDEBAR */}
        <aside
          className={cx(
            "fixed inset-y-0 left-0 z-50 w-[280px] transform bg-[#144336] text-white transition-transform md:static md:translate-x-0",
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
                <div className="text-xs text-white/70">SuperAdmin</div>
              </div>

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
                  {roles.map((r: any) => (
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
            <nav className="flex-1 overflow-y-auto p-3 space-y-2">
              {visibleNav.map((item) => {
                if (item.type === "link") {
                  const active = isActivePath(pathname, item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onNavigate}
                      className={cx(
                        "flex items-center justify-between rounded-xl px-3 py-2 text-sm font-medium transition",
                        active
                          ? "bg-[#144336] text-white shadow-sm"
                          : "text-white/80 hover:bg-white/10 hover:text-white"
                      )}
                    >
                      <span className="inline-flex items-center gap-2">
                        {item.icon}
                        {item.label}
                      </span>
                      {active && <span className="text-xs opacity-70">●</span>}
                    </Link>
                  );
                }

                // group
                const anyActive = item.children.some((c) =>
                  isActivePath(pathname, c.href)
                );
                const open = !!openGroups[item.id];

                return (
                  <div
                    key={item.id}
                    className="rounded-xl border border-white/10 bg-white/0"
                  >
                    <button
                      type="button"
                      onClick={() => toggleGroup(item.id)}
                      className={cx(
                        "w-full flex items-center justify-between rounded-xl px-3 py-2 text-sm font-semibold transition",
                        anyActive
                          ? "bg-[#144336] text-white"
                          : "text-white/85 hover:bg-white/10"
                      )}
                    >
                      <span className="inline-flex items-center gap-2">
                        {item.icon}
                        {item.label}
                      </span>
                      <span className="inline-flex items-center gap-2 text-white/70">
                        {open ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </span>
                    </button>

                    {open && (
                      <div className="px-2 pb-2">
                        <div className="mt-1 space-y-1">
                          {item.children.map((c) => {
                            const active = isActivePath(pathname, c.href);
                            return (
                              <Link
                                key={c.href}
                                href={c.href}
                                onClick={onNavigate}
                                className={cx(
                                  "flex items-center justify-between rounded-xl px-3 py-2 text-sm transition",
                                  active
                                    ? "bg-white/10 text-white"
                                    : "text-white/75 hover:bg-white/10 hover:text-white"
                                )}
                              >
                                <span className="inline-flex items-center gap-2">
                                  {c.icon}
                                  {c.label}
                                </span>
                                {active && (
                                  <span className="text-xs opacity-70">●</span>
                                )}
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>

            {/* Logout */}
            <div className="p-4 border-t border-white/10">
              <button
                onClick={() => logout?.()}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-sm font-semibold text-white hover:bg-white/20 transition"
              >
                <LogOut className="h-4 w-4" />
                Cerrar sesión
              </button>
            </div>
          </div>
        </aside>

        {/* MAIN */}
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
