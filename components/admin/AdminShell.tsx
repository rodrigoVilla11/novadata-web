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
  LayoutDashboard,
  Users,
  UserCog,
  Truck,
  Package,
  Boxes,
  Layers,
  Tags,
  ClipboardList,
  CalendarCheck2,
  Factory,
  ShoppingCart,
  Wallet,
  BarChart3,
  ArrowRightLeft,
  FolderTree,
  TrendingUp,
  Settings,
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
  if (href === "/admin") return pathname === "/admin";
  return (
    pathname === href ||
    pathname.startsWith(href + "/") ||
    pathname.startsWith(href)
  );
}

function titleCase(s: string) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

/** Mini helpers para mostrar título/subtítulo según ruta */
function getPageMeta(pathname: string) {
  // orden: más específico → más general
  const map: Array<{ starts: string; title: string; subtitle: string }> = [
    { starts: "/admin/settings", title: "Settings", subtitle: "Sucursal" },

    {
      starts: "/admin/finance/stats",
      title: "Finance",
      subtitle: "Estadísticas",
    },
    {
      starts: "/admin/finance/categories",
      title: "Finance",
      subtitle: "Categorías",
    },
    {
      starts: "/admin/finance/accounts",
      title: "Finance",
      subtitle: "Cuentas",
    },
    {
      starts: "/admin/finance/movements",
      title: "Finance",
      subtitle: "Movimientos",
    },
    { starts: "/admin/finance", title: "Finance", subtitle: "Overview" },

    { starts: "/admin/pos", title: "POS", subtitle: "Ventas" },
    { starts: "/admin/orders", title: "POS", subtitle: "Órdenes / Pedidos" },

    { starts: "/admin/stock", title: "Inventario", subtitle: "Stock" },
    {
      starts: "/admin/suppliers",
      title: "Inventario",
      subtitle: "Proveedores",
    },

    { starts: "/admin/products", title: "Catálogo", subtitle: "Productos" },
    {
      starts: "/admin/ingredients",
      title: "Catálogo",
      subtitle: "Ingredientes",
    },
    {
      starts: "/admin/preparations",
      title: "Catálogo",
      subtitle: "Preparaciones",
    },
    { starts: "/admin/categories", title: "Catálogo", subtitle: "Categorías" },

    { starts: "/admin/users", title: "Personas", subtitle: "Usuarios" },
    { starts: "/admin/employees", title: "Personas", subtitle: "Empleados" },
    { starts: "/admin/attendance", title: "Personas", subtitle: "Asistencia" },

    { starts: "/admin/cash", title: "Operación", subtitle: "Caja" },
    { starts: "/admin/tasks", title: "Operación", subtitle: "Tareas" },

    { starts: "/admin", title: "Dashboard", subtitle: "Resumen" },
  ];

  const found = map.find(
    (m) => pathname === m.starts || pathname.startsWith(m.starts + "/")
  );
  if (found) return found;

  // fallback
  const last = pathname.split("/").filter(Boolean).pop() ?? "Admin";
  return { title: "Admin", subtitle: titleCase(last.replace(/-/g, " ")) };
}

export default function AdminShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  const [mobileOpen, setMobileOpen] = useState(false);
  const roles = (user?.roles ?? []).map((r: string) => String(r).toUpperCase());

  // ---------------- NAV ----------------
  const nav: NavItem[] = [
    {
      type: "link",
      href: "/admin",
      label: "Dashboard",
      roles: ["ADMIN", "MANAGER"],
      icon: <LayoutDashboard className="h-4 w-4" />,
    },
    {
      type: "group",
      id: "pos",
      label: "POS",
      roles: ["ADMIN", "MANAGER", "CASHIER"],
      icon: <ShoppingCart className="h-4 w-4" />,
      children: [
        {
          type: "link",
          href: "/admin/pos",
          label: "Ventas (POS)",
          roles: ["ADMIN", "MANAGER", "CASHIER"],
          icon: <ShoppingCart className="h-4 w-4" />,
        },
        {
          type: "link",
          href: "/admin/orders",
          label: "Órdenes / Pedidos",
          roles: ["ADMIN", "MANAGER", "CASHIER"],
          icon: <ClipboardList className="h-4 w-4" />,
        },
      ],
    },
    {
      type: "group",
      id: "finance",
      label: "Finance",
      roles: ["ADMIN", "MANAGER", "CASHIER"],
      icon: <Wallet className="h-4 w-4" />,
      children: [
        {
          type: "link",
          href: "/admin/finance",
          label: "Overview",
          roles: ["ADMIN", "MANAGER"],
          icon: <BarChart3 className="h-4 w-4" />,
        },
        {
          type: "link",
          href: "/admin/finance/movements",
          label: "Movimientos",
          roles: ["ADMIN", "MANAGER", "CASHIER"],
          icon: <ArrowRightLeft className="h-4 w-4" />,
        },
        {
          type: "link",
          href: "/admin/finance/accounts",
          label: "Cuentas",
          roles: ["ADMIN"],
          icon: <Wallet className="h-4 w-4" />,
        },
        {
          type: "link",
          href: "/admin/finance/categories",
          label: "Categorías",
          roles: ["ADMIN"],
          icon: <FolderTree className="h-4 w-4" />,
        },
        {
          type: "link",
          href: "/admin/finance/stats",
          label: "Estadísticas",
          roles: ["ADMIN", "MANAGER"],
          icon: <TrendingUp className="h-4 w-4" />,
        },
      ],
    },
    {
      type: "group",
      id: "operation",
      label: "Operación",
      roles: ["ADMIN", "MANAGER"],
      icon: <Layers className="h-4 w-4" />,
      children: [
        {
          type: "link",
          href: "/admin/cash",
          label: "Caja",
          roles: ["ADMIN", "MANAGER"],
          icon: <ClipboardList className="h-4 w-4" />,
        },
        {
          type: "link",
          href: "/admin/tasks",
          label: "Tareas",
          roles: ["ADMIN", "MANAGER"],
          icon: <ClipboardList className="h-4 w-4" />,
        },
      ],
    },
    {
      type: "group",
      id: "inventory",
      label: "Inventario",
      roles: ["ADMIN", "MANAGER"],
      icon: <Boxes className="h-4 w-4" />,
      children: [
        {
          type: "link",
          href: "/admin/stock",
          label: "Stock",
          roles: ["ADMIN", "MANAGER"],
          icon: <ClipboardList className="h-4 w-4" />,
        },
        {
          type: "link",
          href: "/admin/suppliers",
          label: "Proveedores",
          roles: ["ADMIN", "MANAGER"],
          icon: <Truck className="h-4 w-4" />,
        },
      ],
    },
    {
      type: "group",
      id: "catalog",
      label: "Catálogo",
      roles: ["ADMIN", "MANAGER"],
      icon: <Package className="h-4 w-4" />,
      children: [
        {
          type: "link",
          href: "/admin/products",
          label: "Productos",
          roles: ["ADMIN", "MANAGER"],
          icon: <Boxes className="h-4 w-4" />,
        },
        {
          type: "link",
          href: "/admin/ingredients",
          label: "Ingredientes",
          roles: ["ADMIN", "MANAGER"],
          icon: <Package className="h-4 w-4" />,
        },
        {
          type: "link",
          href: "/admin/preparations",
          label: "Preparaciones",
          roles: ["ADMIN", "MANAGER"],
          icon: <Layers className="h-4 w-4" />,
        },
        {
          type: "link",
          href: "/admin/categories",
          label: "Categorías",
          roles: ["ADMIN", "MANAGER"],
          icon: <Tags className="h-4 w-4" />,
        },
      ],
    },
    {
      type: "group",
      id: "people",
      label: "Personas",
      roles: ["ADMIN"],
      icon: <Users className="h-4 w-4" />,
      children: [
        {
          type: "link",
          href: "/admin/users",
          label: "Usuarios",
          roles: ["ADMIN"],
          icon: <UserCog className="h-4 w-4" />,
        },
        {
          type: "link",
          href: "/admin/employees",
          label: "Empleados",
          roles: ["ADMIN"],
          icon: <Factory className="h-4 w-4" />,
        },
        {
          type: "link",
          href: "/admin/attendance",
          label: "Asistencia",
          roles: ["ADMIN"],
          icon: <CalendarCheck2 className="h-4 w-4" />,
        },
      ],
    },
    {
      type: "link",
      href: "/admin/settings",
      label: "Settings",
      roles: ["ADMIN", "MANAGER"],
      icon: <Settings className="h-4 w-4" />,
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
  }, [roles]); // nav es constante local

  // Meta
  const { title: pageTitle, subtitle: pageSubtitle } = useMemo(
    () => getPageMeta(pathname),
    [pathname]
  );

  return (
    <AdminProtected>
      <div className="flex min-h-screen bg-linear-to-b from-zinc-50 to-zinc-100 ">
        {/* MOBILE OVERLAY */}
        {mobileOpen && (
          <button
            aria-label="Cerrar menú"
            className="fixed inset-0 z-40 bg-black/40 md:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}

        {/* SIDEBAR */}
        <aside
          className={cx(
            " h-screen fixed inset-y-0 left-0 z-50 w-72 transform bg-[#0f2f26] text-white transition-transform duration-200 ease-out md:sticky md:top-0 md:translate-x-0",
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="flex h-screen flex-col ">
            {/* Brand */}
            <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#144336] ring-1 ring-white/20 shadow-sm">
                <Image
                  src="/logo-white.svg"
                  alt="Gourmetify"
                  width={22}
                  height={22}
                  priority
                />
              </div>

              <div className="leading-tight min-w-0">
                <div className="text-sm font-semibold tracking-wide">
                  GOURMETIFY
                </div>
                <div className="text-xs text-white/70 truncate">
                  Panel administrativo
                </div>
              </div>

              <button
                onClick={() => setMobileOpen(false)}
                className="ml-auto inline-flex items-center justify-center rounded-xl p-2 text-white/80 hover:bg-white/10 active:bg-white/15 md:hidden"
                aria-label="Cerrar menú"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* User */}
            <div className="px-5 py-4 border-b border-white/10">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs text-white/70 truncate">
                    {user?.email ?? "—"}
                  </div>
                  <div className="mt-1 text-sm font-semibold truncate">
                    {(user as any)?.username ??
                      (user as any)?.name ??
                      "Usuario"}
                  </div>
                </div>
              </div>

              {roles.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {roles.map((r) => (
                    <span
                      key={r}
                      className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-white/90"
                    >
                      {r}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* NAV */}
            <nav className="flex-1 overflow-y-scroll [&::-webkit-scrollbar]:hidden p-3">
              <div className="space-y-2">
                {visibleNav.map((item) => {
                  if (item.type === "link") {
                    const active = isActivePath(pathname, item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={onNavigate}
                        className={cx(
                          "group flex items-center justify-between rounded-xl px-3 py-2 text-sm font-medium transition",
                          "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/10",
                          active
                            ? "bg-[#144336] text-white shadow-sm ring-1 ring-white/10"
                            : "text-white/80 hover:bg-white/10 hover:text-white"
                        )}
                      >
                        <span className="inline-flex items-center gap-2 min-w-0">
                          <span
                            className={cx(
                              "inline-flex h-8 w-8 items-center justify-center rounded-xl transition",
                              active
                                ? "bg-white/10"
                                : "bg-white/0 group-hover:bg-white/10"
                            )}
                          >
                            {item.icon}
                          </span>
                          <span className="truncate">{item.label}</span>
                        </span>

                        {active ? (
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        ) : null}
                      </Link>
                    );
                  }

                  const anyActive = item.children.some((c) =>
                    isActivePath(pathname, c.href)
                  );
                  const open = !!openGroups[item.id];

                  return (
                    <div
                      key={item.id}
                      className={cx(
                        "rounded-2xl border border-white/10",
                        anyActive ? "bg-white/5" : "bg-transparent"
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => toggleGroup(item.id)}
                        className={cx(
                          "w-full flex items-center justify-between rounded-2xl px-3 py-2 text-sm font-semibold transition",
                          "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/10",
                          anyActive
                            ? "bg-[#144336] text-white ring-1 ring-white/10"
                            : "text-white/85 hover:bg-white/10"
                        )}
                      >
                        <span className="inline-flex items-center gap-2 min-w-0">
                          <span
                            className={cx(
                              "inline-flex h-8 w-8 items-center justify-center rounded-xl",
                              anyActive ? "bg-white/10" : "bg-white/0"
                            )}
                          >
                            {item.icon}
                          </span>
                          <span className="truncate">{item.label}</span>
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
                                    "group flex items-center justify-between rounded-xl px-3 py-2 text-sm transition",
                                    "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/10",
                                    active
                                      ? "bg-white/10 text-white"
                                      : "text-white/75 hover:bg-white/10 hover:text-white"
                                  )}
                                >
                                  <span className="inline-flex items-center gap-2 min-w-0">
                                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-white/5 group-hover:bg-white/10">
                                      {c.icon}
                                    </span>
                                    <span className="truncate">{c.label}</span>
                                  </span>

                                  {active ? (
                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                                  ) : null}
                                </Link>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </nav>

            {/* Logout */}
            <div className="p-4 border-t border-white/10">
              <button
                onClick={logout}
                className={cx(
                  "flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition",
                  "bg-white/10 text-white hover:bg-white/20 active:bg-white/25",
                  "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/10"
                )}
              >
                <LogOut className="h-4 w-4" />
                Cerrar sesión
              </button>
            </div>
          </div>
        </aside>

        {/* MAIN */}
        <div className="flex-1 min-w-0">
          {/* Top bar */}
          <div className="sticky top-0 z-30 border-b border-zinc-200/60 bg-white/80 backdrop-blur">
            <div className="flex items-center gap-2 px-4 py-3">
              <button
                onClick={() => setMobileOpen(true)}
                className={cx(
                  "md:hidden inline-flex items-center justify-center rounded-xl border border-zinc-200 bg-white p-2 text-zinc-700",
                  "hover:bg-zinc-50 active:bg-zinc-50",
                  "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-zinc-100"
                )}
                aria-label="Abrir menú"
              >
                <Menu className="h-4 w-4" />
              </button>

              <div className="flex-1 min-w-0">
                <div className="text-xs text-zinc-500 truncate">
                  Admin / {pageTitle}
                </div>
                <div className="text-sm font-semibold text-zinc-900 truncate">
                  {pageSubtitle}
                </div>
              </div>

              <button
                onClick={() => router.back()}
                className={cx(
                  "inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700",
                  "hover:bg-zinc-50 active:bg-zinc-50",
                  "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-zinc-100"
                )}
                aria-label="Volver"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Volver</span>
              </button>
            </div>
          </div>

          {/* Content */}
          <main className="mx-auto max-w-7xl px-4 sm:px-6 py-6">
            <div className="space-y-6">{children}</div>
          </main>
        </div>
      </div>
    </AdminProtected>
  );
}
