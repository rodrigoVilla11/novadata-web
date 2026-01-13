"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/app/providers/AuthProvider";
import { apiFetchAuthed } from "@/lib/apiAuthed";

import {
  ArrowRight,
  RefreshCcw,
  AlertTriangle,
  CheckCircle2,
  CalendarDays,
  Package,
  Truck,
  ClipboardList,
  Users,
  BadgeCheck,
  Shield,
  ShoppingCart,
  CreditCard,
  ListChecks,
  Settings2,
} from "lucide-react";

/* =============================================================================
 * Utils
 * ========================================================================== */

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function todayKeyArgentina() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Cordoba",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function normalizeRoles(userRoles: any): string[] {
  return (userRoles ?? []).map((r: any) => String(r).toUpperCase());
}

function hasAnyRole(roles: string[], allowed: string[]) {
  const set = new Set(roles);
  return allowed.some((r) => set.has(r));
}

function buildQS(params: Record<string, any>) {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || `${v}`.trim() === "") return;
    p.set(k, String(v));
  });
  return p.toString();
}

/* =============================================================================
 * Types
 * ========================================================================== */

type StockAlertRow = {
  productId: string;
  name: string;
  providerId?: string | null;
  providerName?: string | null;
  unit?: string | null;
  qty: number | null;
  minQty: number | null;
  status: "LOW" | "NO_COUNT";
};

type PurchaseOrderCounts = { pending: number };

type LinkItem = {
  title: string;
  desc: string;
  href: string;
  icon: React.ReactNode;
  tone?: "default" | "admin" | "manager" | "cashier";
  allow?: string[];
  disabled?: boolean;

  // badges
  badgeText?: string;
  badgeCount?: number;
  badgeTone?: "neutral" | "danger" | "warning" | "success";
};

/* =============================================================================
 * UI bits
 * ========================================================================== */

function toneClasses(tone: LinkItem["tone"]) {
  switch (tone) {
    case "admin":
      return {
        border: "border-indigo-200 hover:border-indigo-300",
        icon: "border-indigo-200 bg-indigo-50 text-indigo-700",
        badge: "border-indigo-200 bg-indigo-50 text-indigo-700",
        ring: "focus:ring-indigo-100",
      };
    case "manager":
      return {
        border: "border-sky-200 hover:border-sky-300",
        icon: "border-sky-200 bg-sky-50 text-sky-700",
        badge: "border-sky-200 bg-sky-50 text-sky-700",
        ring: "focus:ring-sky-100",
      };
    case "cashier":
      return {
        border: "border-amber-200 hover:border-amber-300",
        icon: "border-amber-200 bg-amber-50 text-amber-800",
        badge: "border-amber-200 bg-amber-50 text-amber-800",
        ring: "focus:ring-amber-100",
      };
    default:
      return {
        border: "border-zinc-200 hover:border-[#144336]/40",
        icon: "border-zinc-200 bg-zinc-50 text-[#144336]",
        badge: "border-zinc-200 bg-zinc-50 text-zinc-700",
        ring: "focus:ring-emerald-100",
      };
  }
}

function badgeClass(
  tone: LinkItem["badgeTone"] | undefined,
  fallback: string
) {
  if (tone === "danger") return "border-red-200 bg-red-50 text-red-700";
  if (tone === "warning") return "border-amber-200 bg-amber-50 text-amber-800";
  if (tone === "success")
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  return fallback; // neutral
}

function CardLink(item: LinkItem) {
  const t = toneClasses(item.tone);
  const showCount = typeof item.badgeCount === "number" && item.badgeCount > 0;
  const showBadge = !!item.badgeText || showCount;

  if (item.disabled) {
    return (
      <div
        className={cn(
          "rounded-2xl border bg-white p-4 sm:p-5 opacity-60",
          "cursor-not-allowed select-none",
          t.border
        )}
      >
        <div className="flex items-start gap-3">
          <div className={cn("mt-0.5 rounded-xl p-2 border shrink-0", t.icon)}>
            {item.icon}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-base font-semibold text-zinc-900 truncate">
                {item.title}
              </div>
              {showBadge && (
                <span
                  className={cn(
                    "shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
                    badgeClass(item.badgeTone, t.badge)
                  )}
                >
                  {showCount ? item.badgeCount : item.badgeText}
                </span>
              )}
            </div>

            <div className="mt-1 text-sm text-zinc-500 leading-snug">
              {item.desc}
            </div>

            <div className="mt-3 text-sm font-semibold text-zinc-500">
              No disponible
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Link
      href={item.href}
      className={cn(
        "group block rounded-2xl border bg-white p-4 sm:p-5 transition",
        "hover:-translate-y-0.5 hover:shadow-md",
        "focus:outline-none focus:ring-4",
        t.border,
        t.ring
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn("mt-0.5 rounded-xl p-2 border shrink-0", t.icon)}>
          {item.icon}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-base font-semibold text-zinc-900 truncate">
              {item.title}
            </div>

            {showBadge && (
              <span
                className={cn(
                  "shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
                  badgeClass(item.badgeTone, t.badge)
                )}
              >
                {showCount ? item.badgeCount : item.badgeText}
              </span>
            )}
          </div>

          <div className="mt-1 text-sm text-zinc-500 leading-snug">
            {item.desc}
          </div>

          <div className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-zinc-800">
            Abrir
            <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
          </div>
        </div>
      </div>
    </Link>
  );
}

function RolesChips({ roles }: { roles: string[] }) {
  if (!roles.length)
    return <span className="text-xs text-zinc-500">Sin roles</span>;

  const toneByRole: Record<string, string> = {
    ADMIN: "border-indigo-200 bg-indigo-50 text-indigo-700",
    MANAGER: "border-sky-200 bg-sky-50 text-sky-700",
    CASHIER: "border-amber-200 bg-amber-50 text-amber-800",
  };

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      {roles.map((r) => (
        <span
          key={r}
          className={cn(
            "rounded-full border px-2.5 py-1 text-xs font-semibold",
            toneByRole[r] ?? "border-zinc-200 bg-zinc-50 text-zinc-700"
          )}
        >
          {r}
        </span>
      ))}
    </div>
  );
}

function Section({
  title,
  subtitle,
  items,
}: {
  title: string;
  subtitle: string;
  items: LinkItem[];
}) {
  if (!items.length) return null;
  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-base font-semibold text-zinc-900">{title}</h2>
        <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((x) => (
          <CardLink key={`${x.href}-${x.title}`} {...x} />
        ))}
      </div>
    </div>
  );
}

/* =============================================================================
 * Page
 * ========================================================================== */

export default function AdminHomePage() {
  const auth = useAuth() as any;
  const user = auth?.user;
  const getAccessToken = auth?.getAccessToken;

  const roles = useMemo(() => normalizeRoles(user?.roles), [user?.roles]);
  const isAdmin = roles.includes("ADMIN");
  const isManager = roles.includes("MANAGER");
  const isCashier = roles.includes("CASHIER");

  const [dateKey, setDateKey] = useState(todayKeyArgentina());

  // alerts
  const [stockAlerts, setStockAlerts] = useState<StockAlertRow[]>([]);
  const [poPending, setPoPending] = useState(0);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reqSeq = useRef(0);

  async function load() {
    if (!getAccessToken) return;

    const seq = ++reqSeq.current;
    setError(null);
    setLoading(true);

    try {
      const qs = buildQS({ dateKey });

      const [a, c] = await Promise.all([
        apiFetchAuthed<StockAlertRow[]>(getAccessToken, `/stock/alerts?${qs}`),
        apiFetchAuthed<PurchaseOrderCounts>(
          getAccessToken,
          `/purchase-orders/counts`
        ),
      ]);

      if (seq !== reqSeq.current) return;

      setStockAlerts(Array.isArray(a) ? a : []);
      setPoPending(Number(c?.pending ?? 0) || 0);
    } catch (e: any) {
      if (seq !== reqSeq.current) return;
      setError(e?.message || "Error cargando panel");
      setStockAlerts([]);
      setPoPending(0);
    } finally {
      if (seq !== reqSeq.current) return;
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateKey, getAccessToken]);

  const stats = useMemo(() => {
    const low = stockAlerts.filter((x) => x.status === "LOW").length;
    const noCount = stockAlerts.filter((x) => x.status === "NO_COUNT").length;
    return {
      low,
      noCount,
      stockProblems: low + noCount,
      poPending,
    };
  }, [stockAlerts, poPending]);

  const overallOk =
    !loading && stats.stockProblems === 0 && (stats.poPending ?? 0) === 0;

  // links (con badges dinámicos)
  const links = useMemo<LinkItem[]>(
    () => [
      {
        title: "Stock",
        desc: "Alertas, conteos y control diario.",
        href: "/admin/stock",
        icon: <Package className="h-5 w-5" />,
        allow: ["ADMIN", "MANAGER"],
        tone: "manager",
        badgeCount: stats.stockProblems,
        badgeTone: stats.stockProblems > 0 ? "danger" : "neutral",
      },
      {
        title: "Órdenes de compra",
        desc: "Crear, activar/desactivar, editar y hacer pedidos a proveedores y recepción.",
        href: "/admin/suppliers",
        icon: <Truck className="h-5 w-5" />,
        allow: ["ADMIN", "MANAGER"],
        tone: "manager",
        badgeCount: stats.poPending,
        badgeTone: stats.poPending > 0 ? "warning" : "neutral",
      },

      // Operación diaria
      {
        title: "Asistencia",
        desc: "Check-in / Check-out por fecha y empleado.",
        href: "/admin/attendance",
        icon: <BadgeCheck className="h-5 w-5" />,
        allow: ["ADMIN", "MANAGER"],
      },

      {
        title: "Ingredientes",
        desc: "Crear, editar y gestionar stock/umbrales.",
        href: "/admin/ingredients",
        icon: <Package className="h-5 w-5" />,
        allow: ["ADMIN", "MANAGER"],
      },
      {
        title: "Tareas",
        desc: "Catálogo de tareas y áreas (para weekly).",
        href: "/admin/tasks",
        icon: <ClipboardList className="h-5 w-5" />,
        allow: ["ADMIN", "MANAGER"],
      },
      {
        title: "Empleados",
        desc: "Altas, edición, estado y vínculo a usuario.",
        href: "/admin/employees",
        icon: <Users className="h-5 w-5" />,
        allow: ["ADMIN", "MANAGER"],
      },

      // Manager
      {
        title: "Weekly",
        desc: "Revisar y gestionar reportes semanales.",
        href: "/manager/weekly",
        icon: <CalendarDays className="h-5 w-5" />,
        tone: "manager",
        allow: ["ADMIN", "MANAGER"],
      },

      // Cashier / POS
      {
        title: "POS",
        desc: "Crear ventas y cobrar (hoy).",
        href: "/cashier/pos",
        icon: <ShoppingCart className="h-5 w-5" />,
        tone: "cashier",
        allow: ["ADMIN", "MANAGER", "CASHIER"],
      },
      {
        title: "Órdenes (Caja)",
        desc: "Ver órdenes, abrir al costado y cobrar.",
        href: "/cashier/orders",
        icon: <CreditCard className="h-5 w-5" />,
        tone: "cashier",
        allow: ["ADMIN", "MANAGER", "CASHIER"],
      },

      // Admin-only
      {
        title: "Usuarios",
        desc: "Crear usuarios, asignar roles y vincular empleados.",
        href: "/admin/users",
        icon: <Shield className="h-5 w-5" />,
        badgeText: "SOLO ADMIN",
        tone: "admin",
        allow: ["ADMIN"],
      },
      {
        title: "Configuración",
        desc: "Ajustes del sistema (permisos, catálogos, etc.).",
        href: "/admin/settings",
        icon: <Settings2 className="h-5 w-5" />,
        badgeText: "SOLO ADMIN",
        tone: "admin",
        allow: ["ADMIN"],
        disabled: false,
      },
    ],
    [stats.stockProblems, stats.poPending]
  );

  const visible = useMemo(() => {
    return links.filter((l) => {
      if (!l.allow?.length) return true;
      return hasAnyRole(roles, l.allow);
    });
  }, [links, roles]);


  const opLinks = useMemo(
    () =>
      visible.filter((l) =>
        [
          "/admin/attendance",
          "/admin/suppliers",
          "/admin/ingredients",
          "/admin/tasks",
          "/admin/employees",
        ].includes(l.href)
      ),
    [visible]
  );

  const managerLinks = useMemo(
    () => visible.filter((l) => l.href.startsWith("/manager/")),
    [visible]
  );
  const cashierLinks = useMemo(
    () => visible.filter((l) => l.href.startsWith("/cashier/")),
    [visible]
  );
  const adminLinks = useMemo(
    () => visible.filter((l) => l.href.startsWith("/admin/") && l.tone === "admin"),
    [visible]
  );

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Header */}
      <div className="rounded-3xl border border-zinc-200 bg-white p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          {/* Left */}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-zinc-900">
                Panel de control
              </h1>

              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs font-semibold border",
                  loading
                    ? "bg-zinc-50 text-zinc-700 border-zinc-200"
                    : overallOk
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-red-50 text-red-700 border-red-200"
                )}
              >
                {loading ? "Cargando..." : overallOk ? "Todo OK" : "Requiere atención"}
              </span>
            </div>

            <p className="mt-1 text-sm text-zinc-500">
              Accesos rápidos + alertas operativas (stock y compras).
            </p>

            <RolesChips roles={roles} />
          </div>

          {/* Right */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-end">
            {/* Fecha (mobile + desktop) */}
            <div className="w-full sm:w-auto">
              <label className="mb-1 block text-xs font-semibold text-zinc-600">
                Fecha
              </label>
              <div className="flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-3 py-2">
                <CalendarDays className="h-4 w-4 text-zinc-500" />
                <input
                  type="date"
                  value={dateKey}
                  onChange={(e) => setDateKey(e.target.value)}
                  className="w-full bg-transparent text-sm outline-none"
                />
              </div>
            </div>

            {/* Recargar */}
            <button
              onClick={async () => {
                setBusy(true);
                await load();
                setBusy(false);
              }}
              className={cn(
                "inline-flex w-full sm:w-auto items-center justify-center rounded-2xl border px-3 py-2",
                "border-zinc-200 bg-white hover:bg-zinc-50",
                "focus:outline-none focus:ring-4 focus:ring-emerald-100"
              )}
              title="Recargar"
            >
              <RefreshCcw className={cn("h-4 w-4", busy ? "animate-spin" : "")} />
              <span className="ml-2 text-sm font-semibold sm:hidden">Recargar</span>
            </button>
          </div>
        </div>

        {busy ? (
          <div className="mt-3 text-xs text-zinc-500 flex items-center gap-2">
            <RefreshCcw className="h-3.5 w-3.5 animate-spin" />
            Actualizando datos…
          </div>
        ) : null}

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* CTA contextual */}
        <div className="mt-5 flex flex-col sm:flex-row flex-wrap gap-2">
          {isAdmin ? (
            <Link
              href="/admin/users"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-[#144336] px-4 py-2 text-sm font-semibold text-white hover:bg-[#10362b] focus:outline-none focus:ring-4 focus:ring-emerald-100"
            >
              <Shield className="h-4 w-4" />
              Usuarios & Roles
              <ArrowRight className="h-4 w-4" />
            </Link>
          ) : isCashier ? (
            <Link
              href="/cashier/orders"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-[#144336] px-4 py-2 text-sm font-semibold text-white hover:bg-[#10362b] focus:outline-none focus:ring-4 focus:ring-emerald-100"
            >
              <CreditCard className="h-4 w-4" />
              Ir a cobros
              <ArrowRight className="h-4 w-4" />
            </Link>
          ) : isManager ? (
            <Link
              href="/manager/weekly"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-[#144336] px-4 py-2 text-sm font-semibold text-white hover:bg-[#10362b] focus:outline-none focus:ring-4 focus:ring-emerald-100"
            >
              <ListChecks className="h-4 w-4" />
              Abrir Weekly
              <ArrowRight className="h-4 w-4" />
            </Link>
          ) : null}
        </div>
      </div>

      {/* Cards resumen */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {/* Stock */}
        <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-zinc-900">Stock</div>
            {stats.stockProblems > 0 ? (
              <AlertTriangle className="h-5 w-5 text-red-600" />
            ) : (
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            )}
          </div>

          <div className="mt-2 text-3xl font-bold">{stats.low}</div>
          <p className="text-sm text-zinc-600">
            Bajo mínimo • Sin conteo: <b>{stats.noCount}</b>
          </p>

          <Link
            href="/admin/stock"
            className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#144336] px-4 py-2 text-sm font-semibold text-white hover:bg-[#10362b] focus:outline-none focus:ring-4 focus:ring-emerald-100"
          >
            <Package className="h-4 w-4" />
            Ir a Stock
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {/* Órdenes de compra */}
        <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-zinc-900">
              Órdenes de compra
            </div>
            {stats.poPending > 0 ? (
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            ) : (
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            )}
          </div>

          <div className="mt-2 text-3xl font-bold">{stats.poPending}</div>
          <p className="text-sm text-zinc-600">Pendientes (abiertas)</p>

          <Link
            href="/admin/suppliers"
            className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#144336] px-4 py-2 text-sm font-semibold text-white hover:bg-[#10362b] focus:outline-none focus:ring-4 focus:ring-emerald-100"
          >
            <Truck className="h-4 w-4" />
            Ver proveedores
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {/* Accesos rápidos */}
        <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm sm:col-span-2 xl:col-span-1">
          <div className="text-sm font-semibold text-zinc-900">Accesos rápidos</div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
            {isCashier && (
              <Link
                href="/cashier/orders"
                className="inline-flex items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100"
              >
                <span className="inline-flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Cobros
                </span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            )}

            {(isAdmin || isManager) && (
              <Link
                href="/manager/weekly"
                className="inline-flex items-center justify-between gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-900 hover:bg-sky-100"
              >
                <span className="inline-flex items-center gap-2">
                  <ListChecks className="h-4 w-4" />
                  Weekly
                </span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            )}

            {isAdmin && (
              <Link
                href="/admin/users"
                className="inline-flex items-center justify-between gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-900 hover:bg-indigo-100"
              >
                <span className="inline-flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Usuarios
                </span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Links */}
      <div className="space-y-6">

        <Section
          title="Operación diaria"
          subtitle="Lo más usado para gestionar el día a día."
          items={opLinks}
        />

        <Section
          title="Caja / POS"
          subtitle="Ventas, órdenes y cobros (en el día)."
          items={cashierLinks}
        />

        <Section
          title="Gestión"
          subtitle="Paneles para seguimiento y control."
          items={managerLinks}
        />

        <Section
          title="Administración"
          subtitle="Solo ADMIN: usuarios, roles y configuración."
          items={adminLinks}
        />
      </div>
    </div>
  );
}
