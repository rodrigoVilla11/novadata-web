"use client";

import Link from "next/link";
import React, { useMemo } from "react";
import { useAuth } from "@/app/providers/AuthProvider";
import {
  Users,
  ClipboardList,
  Package,
  Truck,
  BadgeCheck,
  Shield,
  ArrowRight,
  CalendarDays,
  ShoppingCart,
  CreditCard,
  ListChecks,
  Settings2,
} from "lucide-react";

/* =============================================================================
 * Helpers
 * ========================================================================== */

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function normalizeRoles(userRoles: any): string[] {
  return (userRoles ?? []).map((r: any) => String(r).toUpperCase());
}

function hasAnyRole(roles: string[], allowed: string[]) {
  const set = new Set(roles);
  return allowed.some((r) => set.has(r));
}

type CardLinkProps = {
  title: string;
  desc: string;
  href: string;
  icon?: React.ReactNode;
  badge?: string;
  tone?: "default" | "admin" | "manager" | "cashier";
  disabled?: boolean;
};

function toneClasses(tone: CardLinkProps["tone"]) {
  switch (tone) {
    case "admin":
      return {
        border: "border-indigo-200 hover:border-indigo-300",
        icon: "border-indigo-200 bg-indigo-50 text-indigo-700",
        badge: "border-indigo-200 bg-indigo-50 text-indigo-700",
        chip: "border-indigo-200 bg-indigo-50 text-indigo-700 group-hover:bg-indigo-100",
        ring: "focus:ring-indigo-100",
      };
    case "manager":
      return {
        border: "border-sky-200 hover:border-sky-300",
        icon: "border-sky-200 bg-sky-50 text-sky-700",
        badge: "border-sky-200 bg-sky-50 text-sky-700",
        chip: "border-sky-200 bg-sky-50 text-sky-700 group-hover:bg-sky-100",
        ring: "focus:ring-sky-100",
      };
    case "cashier":
      return {
        border: "border-amber-200 hover:border-amber-300",
        icon: "border-amber-200 bg-amber-50 text-amber-800",
        badge: "border-amber-200 bg-amber-50 text-amber-800",
        chip: "border-amber-200 bg-amber-50 text-amber-800 group-hover:bg-amber-100",
        ring: "focus:ring-amber-100",
      };
    default:
      return {
        border: "border-zinc-200 hover:border-[#144336]/40",
        icon: "border-zinc-200 bg-zinc-50 text-[#144336]",
        badge: "border-zinc-200 bg-zinc-50 text-zinc-700",
        chip: "border-zinc-200 bg-zinc-50 text-zinc-700 group-hover:bg-zinc-100",
        ring: "focus:ring-emerald-100",
      };
  }
}

function CardLink({
  title,
  desc,
  href,
  icon,
  badge,
  tone = "default",
  disabled,
}: CardLinkProps) {
  const t = toneClasses(tone);

  if (disabled) {
    return (
      <div
        className={cn(
          "rounded-2xl border bg-white p-5 opacity-60",
          "cursor-not-allowed select-none",
          t.border
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className={cn("mt-0.5 rounded-xl p-2 border", t.icon)}>
              {icon}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-base font-semibold text-zinc-900">
                  {title}
                </div>
                {badge && (
                  <span
                    className={cn(
                      "rounded-full border px-2.5 py-0.5 text-xs font-semibold",
                      t.badge
                    )}
                  >
                    {badge}
                  </span>
                )}
              </div>
              <div className="mt-1 text-sm text-zinc-500">{desc}</div>
              <div className="mt-3 text-sm font-semibold text-zinc-500">
                No disponible
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Link
      href={href}
      className={cn(
        "group block rounded-2xl border bg-white p-5 transition",
        "hover:-translate-y-0.5 hover:shadow-md",
        "focus:outline-none focus:ring-4",
        t.border,
        t.ring
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className={cn("mt-0.5 rounded-xl p-2 border", t.icon)}>
            {icon}
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-base font-semibold text-zinc-900">
                {title}
              </div>

              {badge && (
                <span
                  className={cn(
                    "rounded-full border px-2.5 py-0.5 text-xs font-semibold",
                    t.badge
                  )}
                >
                  {badge}
                </span>
              )}
            </div>

            <div className="mt-1 text-sm text-zinc-500">{desc}</div>

            <div className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-zinc-800">
              Abrir
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </div>
          </div>
        </div>

        <span
          className={cn(
            "hidden sm:inline-flex rounded-xl border px-2.5 py-1 text-xs font-semibold",
            t.chip
          )}
        >
          Ir
        </span>
      </div>
    </Link>
  );
}

function SectionHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-base font-semibold text-zinc-900">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

function RolesChips({ roles }: { roles: string[] }) {
  if (!roles.length) return <span className="text-xs text-zinc-500">Sin roles</span>;

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

/* =============================================================================
 * Page
 * ========================================================================== */

type LinkItem = {
  title: string;
  desc: string;
  href: string;
  icon: React.ReactNode;
  badge?: string;
  tone?: CardLinkProps["tone"];
  allow?: string[]; // si existe: roles permitidos
  disabled?: boolean;
};

export default function AdminHomePage() {
  const { user } = useAuth();
  const roles = useMemo(() => normalizeRoles(user?.roles), [user?.roles]);

  const isAdmin = roles.includes("ADMIN");
  const isManager = roles.includes("MANAGER");
  const isCashier = roles.includes("CASHIER");

  // ⚠️ Como pediste: no meto FINANCE acá (lo estamos rehaciendo).
  const links = useMemo<LinkItem[]>(
    () => [
      // Operación diaria (común)
      {
        title: "Asistencia",
        desc: "Check-in / Check-out por fecha y empleado.",
        href: "/admin/attendance",
        icon: <BadgeCheck className="h-5 w-5" />,
        allow: ["ADMIN", "MANAGER"],
      },
      {
        title: "Proveedores",
        desc: "Crear, activar/desactivar y editar proveedores.",
        href: "/admin/suppliers",
        icon: <Truck className="h-5 w-5" />,
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

      // Cashier / POS (lo nuevo)
      {
        title: "POS",
        desc: "Crear ventas y cobrar (hoy).",
        href: "/cashier/pos",
        icon: <ShoppingCart className="h-5 w-5" />,
        tone: "cashier",
        allow: ["ADMIN", "MANAGER", "CASHIER"],
      },
      {
        title: "Órdenes (Cashier)",
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
        badge: "SOLO ADMIN",
        tone: "admin",
        allow: ["ADMIN"],
      },
      {
        title: "Configuración",
        desc: "Ajustes del sistema (permisos, catálogos, etc.).",
        href: "/admin/settings",
        icon: <Settings2 className="h-5 w-5" />,
        badge: "SOLO ADMIN",
        tone: "admin",
        allow: ["ADMIN"],
        // si todavía no existe la página, dejalo deshabilitado:
        disabled: false,
      },
    ],
    []
  );

  const visible = useMemo(() => {
    return links.filter((l) => {
      if (!l.allow?.length) return true;
      return hasAnyRole(roles, l.allow);
    });
  }, [links, roles]);

  const opLinks = visible.filter((l) =>
    ["/admin/attendance", "/admin/suppliers", "/admin/ingredients", "/admin/tasks", "/admin/employees"].includes(
      l.href
    )
  );
  const managerLinks = visible.filter((l) => l.href.startsWith("/manager/"));
  const cashierLinks = visible.filter((l) => l.href.startsWith("/cashier/"));
  const adminLinks = visible.filter((l) => l.href.startsWith("/admin/") && l.tone === "admin");

  return (
    <div className="space-y-6">
      {/* Hero / Header */}
      <div className="relative overflow-hidden rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
        {/* acento marca */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-[#144336]" />

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
              Panel de control
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              Accesos rápidos según tu rol.
            </p>

            <RolesChips roles={roles} />
          </div>

          {/* CTA contextual */}
          {isAdmin ? (
            <Link
              href="/admin/users"
              className="inline-flex items-center gap-2 rounded-xl bg-[#144336] px-4 py-2 text-sm font-semibold text-white hover:bg-[#10362b] focus:outline-none focus:ring-4 focus:ring-emerald-100"
            >
              <Shield className="h-4 w-4" />
              Usuarios & Roles
              <ArrowRight className="h-4 w-4" />
            </Link>
          ) : isCashier ? (
            <Link
              href="/cashier/orders"
              className="inline-flex items-center gap-2 rounded-xl bg-[#144336] px-4 py-2 text-sm font-semibold text-white hover:bg-[#10362b] focus:outline-none focus:ring-4 focus:ring-emerald-100"
            >
              <CreditCard className="h-4 w-4" />
              Ir a cobros
              <ArrowRight className="h-4 w-4" />
            </Link>
          ) : isManager ? (
            <Link
              href="/manager/weekly"
              className="inline-flex items-center gap-2 rounded-xl bg-[#144336] px-4 py-2 text-sm font-semibold text-white hover:bg-[#10362b] focus:outline-none focus:ring-4 focus:ring-emerald-100"
            >
              <ListChecks className="h-4 w-4" />
              Abrir Weekly
              <ArrowRight className="h-4 w-4" />
            </Link>
          ) : null}
        </div>

        {/* mini hint */}
        {(isAdmin || isManager) && (
          <div className="mt-5 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
            <b>Tip:</b> si alguien no ve su panel, revisá el vínculo{" "}
            <b>Usuario → Employee</b> y los roles asignados.
          </div>
        )}
      </div>

      {/* Operación diaria */}
      {opLinks.length > 0 && (
        <div className="space-y-3">
          <SectionHeader
            title="Operación diaria"
            subtitle="Lo más usado para gestionar el día a día."
          />
          <div className="grid gap-3 md:grid-cols-2">
            {opLinks.map((x) => (
              <CardLink
                key={x.href}
                title={x.title}
                desc={x.desc}
                href={x.href}
                icon={x.icon}
                badge={x.badge}
                tone={x.tone}
                disabled={x.disabled}
              />
            ))}
          </div>
        </div>
      )}

      {/* Caja / POS */}
      {cashierLinks.length > 0 && (
        <div className="space-y-3">
          <SectionHeader
            title="Caja / POS"
            subtitle="Ventas, órdenes y cobros (en el día)."
          />
          <div className="grid gap-3 md:grid-cols-2">
            {cashierLinks.map((x) => (
              <CardLink
                key={x.href}
                title={x.title}
                desc={x.desc}
                href={x.href}
                icon={x.icon}
                badge={x.badge}
                tone={x.tone ?? "cashier"}
                disabled={x.disabled}
              />
            ))}
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-5 text-sm text-amber-900">
            <b>Nota:</b> si querés que <b>Órdenes</b> “abra al costado” como el
            otro panel, mantenemos el patrón de <b>split view</b> (lista + detalle
            fijo) en <code>/cashier/orders</code>.
          </div>
        </div>
      )}

      {/* Manager */}
      {managerLinks.length > 0 && (
        <div className="space-y-3">
          <SectionHeader
            title="Gestión"
            subtitle="Paneles para seguimiento y control."
          />
          <div className="grid gap-3 md:grid-cols-2">
            {managerLinks.map((x) => (
              <CardLink
                key={x.href}
                title={x.title}
                desc={x.desc}
                href={x.href}
                icon={x.icon}
                badge={x.badge}
                tone={x.tone ?? "manager"}
                disabled={x.disabled}
              />
            ))}
          </div>
        </div>
      )}

      {/* Administración (solo ADMIN) */}
      {adminLinks.length > 0 && (
        <div className="space-y-3">
          <SectionHeader
            title="Administración"
            subtitle="Solo ADMIN: usuarios, roles y configuración."
          />
          <div className="grid gap-3 md:grid-cols-2">
            {adminLinks.map((x) => (
              <CardLink
                key={x.href}
                title={x.title}
                desc={x.desc}
                href={x.href}
                icon={x.icon}
                badge={x.badge}
                tone="admin"
                disabled={x.disabled}
              />
            ))}
          </div>

          <div className="rounded-2xl border border-indigo-200 bg-indigo-50/70 p-5 text-sm text-indigo-900">
            <b>Tip:</b> para que un empleado vea <b>Weekly</b>, asegurate de que
            tenga rol <b>MANAGER</b> (o <b>ADMIN</b>) y que el{" "}
            <b>Usuario → Employee</b> esté vinculado.
          </div>
        </div>
      )}
    </div>
  );
}
