"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AdminProtected } from "@/components/AdminProtected";
import { useAuth } from "@/app/providers/AuthProvider";
import { apiFetchAuthed } from "@/lib/apiAuthed";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  ArrowRight,
  FolderTree,
  Wallet,
  BarChart3,
  ArrowLeftRight,
  RefreshCcw,
  PlusCircle,
  TrendingUp,
  TrendingDown,
  CalendarDays,
  Lock,
  SlidersHorizontal,
  X,
  Sparkles,
} from "lucide-react";

/* =============================================================================
 * Helpers
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

function moneyARS(n: number) {
  const v = Number(n ?? 0) || 0;
  return v.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
}

type StatsRes = {
  range: { from: string; to: string };
  totals: {
    income: number;
    expense: number;
    net: number;
    transferOut: number;
    transferIn: number;
  };
};

/* =============================================================================
 * Minimal Drawer (no deps)
 * - Bottom sheet on mobile
 * ========================================================================== */

function Drawer({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    setTimeout(() => panelRef.current?.focus(), 0);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-60">
      <button
        aria-label="Cerrar"
        className="absolute inset-0 bg-black/35"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        className="absolute bottom-0 left-0 right-0 max-h-[88vh] overflow-hidden rounded-t-3xl border-t border-zinc-200 bg-white shadow-2xl outline-none"
      >
        <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-10 rounded-full bg-zinc-200" />
            <h3 className="text-sm font-semibold text-zinc-900">
              {title || "Panel"}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-900 hover:bg-zinc-50"
          >
            <X className="h-4 w-4" />
            Cerrar
          </button>
        </div>

        <div className="max-h-[calc(88vh-112px)] overflow-auto p-4">
          {children}
        </div>

        {footer ? (
          <div className="border-t border-zinc-100 bg-white p-3">{footer}</div>
        ) : null}
      </div>
    </div>
  );
}

/* =============================================================================
 * UI
 * ========================================================================== */

function ItemCard({
  href,
  title,
  description,
  icon: Icon,
  badge,
}: {
  href: string;
  title: string;
  description: string;
  icon: React.ElementType;
  badge?: string;
}) {
  return (
    <Link href={href} className="group block">
      <div className="h-full rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-700 transition group-hover:bg-zinc-200">
              <Icon className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-semibold text-zinc-900">
                  {title}
                </h3>
                {badge ? (
                  <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[11px] font-semibold text-zinc-600">
                    {badge}
                  </span>
                ) : null}
              </div>
              <p className="mt-0.5 line-clamp-2 text-sm text-zinc-500">
                {description}
              </p>
            </div>
          </div>

          <ArrowRight className="mt-1 h-5 w-5 shrink-0 text-zinc-400 transition group-hover:translate-x-0.5" />
        </div>
      </div>
    </Link>
  );
}

function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ElementType;
  tone?: "neutral" | "good" | "bad";
}) {
  const ring =
    tone === "good"
      ? "border-emerald-200 bg-emerald-50/50"
      : tone === "bad"
      ? "border-rose-200 bg-rose-50/50"
      : "border-zinc-200 bg-white";

  return (
    <div className={cn("rounded-2xl border p-4 shadow-sm", ring)}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs font-semibold text-zinc-500">{label}</div>
          <div className="mt-1 truncate text-lg font-semibold tracking-tight text-zinc-900">
            {value}
          </div>
          {hint ? (
            <div className="mt-1 text-xs text-zinc-500">{hint}</div>
          ) : null}
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-700">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function QuickAction({
  href,
  title,
  subtitle,
  icon: Icon,
  primary,
}: {
  href: string;
  title: string;
  subtitle?: string;
  icon: React.ElementType;
  primary?: boolean;
}) {
  return (
    <Link href={href} className="group block">
      <div
        className={cn(
          "rounded-2xl border p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md",
          primary
            ? "border-zinc-900 bg-zinc-900 text-white"
            : "border-zinc-200 bg-white text-zinc-900"
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-2xl",
                primary ? "bg-white/10" : "bg-zinc-100 text-zinc-700"
              )}
            >
              <Icon className="h-5 w-5" />
            </div>

            <div className="min-w-0">
              <div
                className={cn(
                  "text-sm font-semibold",
                  primary ? "text-white" : "text-zinc-900"
                )}
              >
                {title}
              </div>
              {subtitle ? (
                <div
                  className={cn(
                    "mt-0.5 text-xs",
                    primary ? "text-white/80" : "text-zinc-500"
                  )}
                >
                  {subtitle}
                </div>
              ) : null}
            </div>
          </div>

          <ArrowRight
            className={cn(
              "mt-0.5 h-5 w-5 shrink-0 transition group-hover:translate-x-0.5",
              primary ? "text-white/70" : "text-zinc-400"
            )}
          />
        </div>
      </div>
    </Link>
  );
}

function TinyChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-700">
      {children}
    </span>
  );
}

/* =============================================================================
 * Page
 * ========================================================================== */

export default function FinancePage() {
  const { getAccessToken } = useAuth();

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [day, setDay] = useState<StatsRes | null>(null);
  const [week, setWeek] = useState<StatsRes | null>(null);
  const [month, setMonth] = useState<StatsRes | null>(null);

  const [actionsOpen, setActionsOpen] = useState(false); // mobile drawer
  const dateKey = useMemo(() => todayKeyArgentina(), []);

  async function load() {
    if (!getAccessToken) return;
    setBusy(true);
    setErr(null);
    try {
      const [d, w, m] = await Promise.all([
        apiFetchAuthed(
          getAccessToken,
          `/finance/stats?periodType=day&dateKey=${dateKey}`
        ),
        apiFetchAuthed(
          getAccessToken,
          `/finance/stats?periodType=week&dateKey=${dateKey}`
        ),
        apiFetchAuthed(
          getAccessToken,
          `/finance/stats?periodType=month&dateKey=${dateKey}`
        ),
      ]);
      setDay(d as StatsRes);
      setWeek(w as StatsRes);
      setMonth(m as StatsRes);
    } catch (e: any) {
      setErr(e?.message || "No se pudieron cargar las estadísticas.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getAccessToken]);

  const net = (s?: StatsRes | null) => Number(s?.totals?.net ?? 0);
  const income = (s?: StatsRes | null) => Number(s?.totals?.income ?? 0);
  const expense = (s?: StatsRes | null) => Number(s?.totals?.expense ?? 0);
  const transferIn = (s?: StatsRes | null) =>
    Number(s?.totals?.transferIn ?? 0);
  const transferOut = (s?: StatsRes | null) =>
    Number(s?.totals?.transferOut ?? 0);

  type Tone = "neutral" | "good" | "bad";

  const netTone = (v: number): Tone => (v >= 0 ? "good" : "bad");

  return (
    <AdminProtected>
      <div className="space-y-4 md:space-y-6">
        {/* Header */}
        <div className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm md:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold tracking-tight text-zinc-900 sm:text-2xl">
                  Finance
                </h1>
                <span className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[11px] font-semibold text-zinc-600">
                  <Sparkles className="h-3.5 w-3.5" />
                  Dashboard
                </span>
              </div>
              <p className="mt-1 text-sm text-zinc-500">
                Control rápido de ingresos/egresos, cuentas, categorías, cierres
                y análisis.
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                <TinyChip>
                  Hoy:{" "}
                  <span className="ml-1 font-semibold text-zinc-800">
                    {dateKey}
                  </span>
                </TinyChip>
                <TinyChip>
                  Transferencias:{" "}
                  <span className="ml-1 font-semibold text-zinc-800">
                    {moneyARS(transferIn(day))} in ·{" "}
                    {moneyARS(transferOut(day))} out
                  </span>
                </TinyChip>
                <TinyChip>Tip: cierre = bloqueo de edición</TinyChip>
              </div>
            </div>

            {/* Desktop actions */}
            <div className="hidden flex-wrap items-center gap-2 sm:flex">
              <Link href="/admin/finance/movements">
                <Button>
                  <span className="inline-flex items-center gap-2">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Nuevo movimiento{" "}
                  </span>
                </Button>
              </Link>

              <Link href="/admin/finance/transfer">
                <Button variant="secondary">
                  <span className="inline-flex items-center gap-2">
                    <ArrowLeftRight className="mr-2 h-4 w-4" />
                    Transferir
                  </span>
                </Button>
              </Link>

              <Link href={`/admin/finance/closings?dateKey=${dateKey}`}>
                <Button variant="secondary">
                  <span className="inline-flex items-center gap-2">
                    <CalendarDays className="mr-2 h-4 w-4" />
                    Cierre del día{" "}
                  </span>
                </Button>
              </Link>

              <Button
                onClick={load}
                disabled={busy}
                variant="secondary"
                title="Actualizar"
              >
                <RefreshCcw className={cn("h-4 w-4", busy && "animate-spin")} />
              </Button>
            </div>

            {/* Mobile actions button */}
            <div className="flex items-center gap-2 sm:hidden">
              <Button
                variant="secondary"
                onClick={() => setActionsOpen(true)}
                className="w-full"
              >
                <SlidersHorizontal className="mr-2 h-4 w-4" />
                Acciones
              </Button>
            </div>
          </div>

          {err ? (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {err}
            </div>
          ) : null}

          {/* KPIs */}
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <KpiCard
              label="Hoy"
              value={moneyARS(net(day))}
              hint={`${moneyARS(income(day))} ingresos · ${moneyARS(
                expense(day)
              )} egresos`}
              icon={net(day) >= 0 ? TrendingUp : TrendingDown}
              tone={netTone(net(day))}
            />
            <KpiCard
              label="Semana"
              value={moneyARS(net(week))}
              hint={`${moneyARS(income(week))} ingresos · ${moneyARS(
                expense(week)
              )} egresos`}
              icon={net(week) >= 0 ? TrendingUp : TrendingDown}
              tone={netTone(net(week))}
            />
            <KpiCard
              label="Mes"
              value={moneyARS(net(month))}
              hint={`${moneyARS(income(month))} ingresos · ${moneyARS(
                expense(month)
              )} egresos`}
              icon={net(month) >= 0 ? TrendingUp : TrendingDown}
              tone={netTone(net(month))}
            />
          </div>

          {/* Secondary KPIs (mobile-friendly) */}
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
              <div className="text-xs font-semibold text-zinc-500">
                Transferencias (hoy)
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm font-semibold text-zinc-900">
                <span>{moneyARS(transferIn(day))} in</span>
                <span className="text-zinc-300">•</span>
                <span>{moneyARS(transferOut(day))} out</span>
              </div>
              <div className="mt-1 text-xs text-zinc-500">
                No afectan el neto, solo mueven saldo entre cuentas.
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
              <div className="text-xs font-semibold text-zinc-500">
                Bloqueo por cierres
              </div>
              <div className="mt-1 flex items-center gap-2 text-sm font-semibold text-zinc-900">
                <Lock className="h-4 w-4 text-zinc-700" />
                <span>Activo</span>
              </div>
              <div className="mt-1 text-xs text-zinc-500">
                Si un día está <b>LOCKED</b>, solo <b>ADMIN</b> puede modificar
                movimientos.
              </div>
            </div>
          </div>
        </div>

        {/* Quick actions (desktop) / Featured (mobile) */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader
              title="Acciones rápidas"
              subtitle="Lo que más se usa en el día a día"
            />
            <CardBody>
              <div className="grid gap-3 sm:grid-cols-2">
                <QuickAction
                  href="/admin/finance/movements"
                  title="Nuevo movimiento"
                  subtitle="Ingreso / egreso con categoría y cuenta"
                  icon={PlusCircle}
                  primary
                />
                <QuickAction
                  href="/admin/finance/transfer"
                  title="Transferir entre cuentas"
                  subtitle="Mover saldo sin afectar el neto"
                  icon={ArrowLeftRight}
                />
                <QuickAction
                  href={`/admin/finance/closings?dateKey=${dateKey}`}
                  title="Cierre del día"
                  subtitle="Enviar (SUBMITTED) o bloquear (LOCKED)"
                  icon={CalendarDays}
                />
                <QuickAction
                  href="/admin/finance/stats"
                  title="Ver estadísticas"
                  subtitle="Comparar ingresos/egresos por período"
                  icon={BarChart3}
                />
              </div>

              <div className="mt-3 text-xs text-zinc-500">
                Tip: si querés comparar meses, mantené categorías consistentes.
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Buenas prácticas" />
            <CardBody>
              <ul className="list-disc space-y-2 pl-5 text-sm text-zinc-700">
                <li>Usá categorías consistentes para comparar meses.</li>
                <li>
                  Transferencias no afectan neto, solo mueven saldo entre
                  cuentas.
                </li>
                <li>Cerrá el día al final de turno para bloquear cambios.</li>
              </ul>
            </CardBody>
          </Card>
        </div>

        {/* Main grid */}
        <Card>
          <CardHeader
            title="Módulos"
            subtitle="Configuración y operación del módulo de finanzas"
          />
          <CardBody>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <ItemCard
                href="/admin/finance/categories"
                title="Categorías"
                description="Ingresos / Egresos y jerarquía padre-hijo."
                icon={FolderTree}
                badge="Config"
              />
              <ItemCard
                href="/admin/finance/accounts"
                title="Cuentas"
                description="Efectivo, banco y billeteras con saldo inicial."
                icon={Wallet}
                badge="Config"
              />
              <ItemCard
                href="/admin/finance/movements"
                title="Movimientos"
                description="Ingresos, egresos y transferencias."
                icon={ArrowLeftRight}
                badge="Operación"
              />
              <ItemCard
                href="/admin/finance/stats"
                title="Estadísticas"
                description="Resumen visual de ingresos, egresos y balances."
                icon={BarChart3}
                badge="Análisis"
              />
              <ItemCard
                href="/admin/finance/transfer"
                title="Transferencias"
                description="Mover dinero entre tus distintas cuentas."
                icon={ArrowLeftRight}
                badge="Operación"
              />
              <ItemCard
                href="/admin/finance/closings"
                title="Cierres"
                description="Declarar, enviar (SUBMITTED) y bloquear (LOCKED)."
                icon={CalendarDays}
                badge="Control"
              />
            </div>
          </CardBody>
        </Card>

        {/* Mobile sticky bottom bar */}
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 bg-white/95 p-3 backdrop-blur sm:hidden">
          <div className="mx-auto flex max-w-3xl items-center gap-2">
            <button
              className="flex-1 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-900 shadow-sm hover:bg-zinc-50 disabled:opacity-60"
              disabled={busy}
              onClick={load}
            >
              <span className="inline-flex items-center justify-center gap-2">
                <RefreshCcw className={cn("h-4 w-4", busy && "animate-spin")} />
                Actualizar
              </span>
            </button>

            <button
              className="flex-1 rounded-2xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-zinc-800 disabled:opacity-60"
              disabled={busy}
              onClick={() => setActionsOpen(true)}
            >
              Acciones
            </button>
          </div>
        </div>

        {/* Actions Drawer (mobile) */}
        <Drawer
          open={actionsOpen}
          onClose={() => setActionsOpen(false)}
          title="Acciones rápidas"
          footer={
            <div className="grid grid-cols-2 gap-2">
              <button
                className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-900 hover:bg-zinc-50 disabled:opacity-60"
                disabled={busy}
                onClick={() => {
                  load();
                  setActionsOpen(false);
                }}
              >
                <span className="inline-flex items-center justify-center gap-2">
                  <RefreshCcw
                    className={cn("h-4 w-4", busy && "animate-spin")}
                  />
                  Actualizar
                </span>
              </button>

              <button
                className="rounded-2xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white hover:bg-zinc-800"
                onClick={() => setActionsOpen(false)}
              >
                Listo
              </button>
            </div>
          }
        >
          <div className="grid gap-3">
            <QuickAction
              href="/admin/finance/movements"
              title="Nuevo movimiento"
              subtitle="Ingreso / egreso"
              icon={PlusCircle}
              primary
            />
            <QuickAction
              href="/admin/finance/transfer"
              title="Transferir"
              subtitle="Entre cuentas"
              icon={ArrowLeftRight}
            />
            <QuickAction
              href={`/admin/finance/closings?dateKey=${dateKey}`}
              title="Cierre del día"
              subtitle="SUBMITTED / LOCKED"
              icon={CalendarDays}
            />
            <QuickAction
              href="/admin/finance/stats"
              title="Estadísticas"
              subtitle="Resumen visual"
              icon={BarChart3}
            />
            <QuickAction
              href="/admin/finance/categories"
              title="Categorías"
              subtitle="Config"
              icon={FolderTree}
            />
            <QuickAction
              href="/admin/finance/accounts"
              title="Cuentas"
              subtitle="Config"
              icon={Wallet}
            />
          </div>

          <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-600">
            <div className="flex items-center gap-2 font-semibold text-zinc-700">
              <Lock className="h-4 w-4" />
              Bloqueo por cierres
            </div>
            <div className="mt-1">
              Si un día está <b>LOCKED</b>, solo <b>ADMIN</b> puede modificar
              movimientos.
            </div>
          </div>
        </Drawer>

        {/* Spacer for mobile sticky bar */}
        <div className="h-16 sm:hidden" />
      </div>
    </AdminProtected>
  );
}
