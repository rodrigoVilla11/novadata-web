"use client";

import Link from "next/link";
import React, { useMemo } from "react";
import { useAuth } from "@/app/providers/AuthProvider";

// Si ya los tenés instalados (los venías usando), suma mucho:
import {
  Users,
  ClipboardList,
  Package,
  Truck,
  BadgeCheck,
  Shield,
  ArrowRight,
} from "lucide-react";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type CardLinkProps = {
  title: string;
  desc: string;
  href: string;
  icon?: React.ReactNode;
  badge?: string;
  tone?: "default" | "admin";
};

function CardLink({
  title,
  desc,
  href,
  icon,
  badge,
  tone = "default",
}: CardLinkProps) {
  return (
    <Link
      href={href}
      className={cn(
        "group block rounded-2xl border bg-white p-5 shadow-sm transition",
        "hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-4",
        tone === "admin"
          ? "border-indigo-200 hover:border-indigo-300 focus:ring-indigo-100"
          : "border-zinc-200 hover:border-zinc-300 focus:ring-zinc-100"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "mt-0.5 rounded-xl p-2 border",
              tone === "admin"
                ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                : "border-zinc-200 bg-zinc-50 text-zinc-700"
            )}
          >
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
                    tone === "admin"
                      ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                      : "border-zinc-200 bg-zinc-50 text-zinc-700"
                  )}
                >
                  {badge}
                </span>
              )}
            </div>

            <div className="mt-1 text-sm text-zinc-500">{desc}</div>

            <div className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-zinc-800">
              Ir
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </div>
          </div>
        </div>

        <span
          className={cn(
            "hidden sm:inline-flex rounded-xl border px-2.5 py-1 text-xs font-semibold",
            tone === "admin"
              ? "border-indigo-200 bg-indigo-50 text-indigo-700 group-hover:bg-indigo-100"
              : "border-zinc-200 bg-zinc-50 text-zinc-700 group-hover:bg-zinc-100"
          )}
        >
          Abrir
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
        <h2 className="text-lg font-semibold text-zinc-900">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

export default function AdminHomePage() {
  const { user } = useAuth();
  const roles = (user?.roles ?? []).map((r: string) => String(r).toUpperCase());
  const isAdmin = roles.includes("ADMIN");

  const quickLinks = useMemo(
    () => [
      {
        title: "Asistencia",
        desc: "Check-in / Check-out por fecha y empleado.",
        href: "/admin/attendance",
        icon: <BadgeCheck className="h-5 w-5" />,
      },
      {
        title: "Proveedores",
        desc: "Crear, activar/desactivar proveedores.",
        href: "/admin/suppliers",
        icon: <Truck className="h-5 w-5" />,
      },
      {
        title: "Productos",
        desc: "Crear, editar y eliminar productos.",
        href: "/admin/products",
        icon: <Package className="h-5 w-5" />,
      },
      {
        title: "Tareas",
        desc: "Catálogo de tareas disponibles.",
        href: "/admin/tasks",
        icon: <ClipboardList className="h-5 w-5" />,
      },
      {
        title: "Empleados",
        desc: "Altas, edición, estado y vínculo a usuario.",
        href: "/admin/employees",
        icon: <Users className="h-5 w-5" />,
      },
      {
        title: "Weekly",
        desc: "Revisar y gestionar reportes semanales.",
        href: "/manager/weekly",
        icon: <BadgeCheck className="h-5 w-5" />,
      },
    ],
    []
  );

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
        {/* Header */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-zinc-900">
                Dashboard Admin
              </h1>
              <p className="mt-1 text-sm text-zinc-500">
                Accesos rápidos para operar el día.
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {roles.length > 0 ? (
                  roles.map((r) => (
                    <span
                      key={r}
                      className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-semibold text-zinc-700"
                    >
                      {r}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-zinc-500">Sin roles</span>
                )}
              </div>
            </div>

            {/* CTA admin (si aplica) */}
            {isAdmin && (
              <Link
                href="/admin/users"
                className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 focus:outline-none focus:ring-4 focus:ring-zinc-200"
              >
                <Shield className="h-4 w-4" />
                Usuarios & Roles
                <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          </div>
        </div>

        {/* Operación diaria */}
        <div className="space-y-3">
          <SectionHeader
            title="Operación diaria"
            subtitle="Lo más usado para gestionar el día a día."
          />

          <div className="grid gap-3 md:grid-cols-2">
            {quickLinks.map((x) => (
              <CardLink key={x.href} {...x} />
            ))}
          </div>
        </div>

        {/* Administración (solo ADMIN) */}
        {isAdmin && (
          <div className="space-y-3">
            <SectionHeader
              title="Administración"
              subtitle="Solo ADMIN: gestión de usuarios, roles y permisos."
            />

            <div className="grid gap-3 md:grid-cols-2">
              <CardLink
                title="Usuarios"
                desc="Crear usuarios, asignar roles y vincular empleados."
                href="/admin/users"
                icon={<Shield className="h-5 w-5" />}
                badge="SOLO ADMIN"
                tone="admin"
              />
            </div>

            <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5 text-sm text-indigo-800">
              Tip: si un empleado no ve su panel, verificá el vínculo{" "}
              <b>Usuario → Employee</b> y que tenga rol
              <b> MANAGER</b> o <b>ADMIN</b> (o el que uses en tu app).
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
