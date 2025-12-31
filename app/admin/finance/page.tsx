"use client";

import React, { useEffect, useMemo, useState } from "react";
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

type StatsPeriodType = "day" | "week" | "month";
type StatsRes = {
  range: { from: string; to: string };
  totals: { income: number; expense: number; net: number; transferOut: number; transferIn: number };
};

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
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-zinc-900">{title}</h3>
                {badge ? (
                  <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[11px] font-semibold text-zinc-600">
                    {badge}
                  </span>
                ) : null}
              </div>
              <p className="mt-0.5 text-sm text-zinc-500">{description}</p>
            </div>
          </div>

          <ArrowRight className="mt-1 h-5 w-5 text-zinc-400 transition group-hover:translate-x-0.5" />
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
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ElementType;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-xs font-semibold text-zinc-500">{label}</div>
          <div className="mt-1 text-lg font-semibold tracking-tight text-zinc-900">{value}</div>
          {hint ? <div className="mt-1 text-xs text-zinc-500">{hint}</div> : null}
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-700">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
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

  const dateKey = useMemo(() => todayKeyArgentina(), []);

  async function load() {
    if (!getAccessToken) return;
    setBusy(true);
    setErr(null);
    try {
      const [d, w, m] = await Promise.all([
        apiFetchAuthed(getAccessToken, `/finance/stats?periodType=day&dateKey=${dateKey}`),
        apiFetchAuthed(getAccessToken, `/finance/stats?periodType=week&dateKey=${dateKey}`),
        apiFetchAuthed(getAccessToken, `/finance/stats?periodType=month&dateKey=${dateKey}`),
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

  return (
    <AdminProtected>
      <div className="space-y-6">
        {/* Header */}
        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Finance</h1>
              <p className="mt-1 text-sm text-zinc-500">
                Control rápido de ingresos/egresos, cuentas, categorías, cierres y análisis.
              </p>
              <div className="mt-3 text-xs text-zinc-500">
                Hoy: <span className="font-semibold text-zinc-700">{dateKey}</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link href="/admin/finance/movements">
                <Button>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Nuevo movimiento
                </Button>
              </Link>

              <Link href="/admin/finance/transfer">
                <Button variant="secondary">
                  <ArrowLeftRight className="mr-2 h-4 w-4" />
                  Transferir
                </Button>
              </Link>

              <Link href={`/admin/finance/closings?dateKey=${dateKey}`}>
                <Button variant="secondary">
                  <CalendarDays className="mr-2 h-4 w-4" />
                  Cierre del día
                </Button>
              </Link>

              <Button onClick={load} disabled={busy} variant="secondary" title="Actualizar">
                <RefreshCcw className={cn("h-4 w-4", busy && "animate-spin")} />
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
              hint={`${moneyARS(income(day))} ingresos · ${moneyARS(expense(day))} egresos`}
              icon={net(day) >= 0 ? TrendingUp : TrendingDown}
            />
            <KpiCard
              label="Semana"
              value={moneyARS(net(week))}
              hint={`${moneyARS(income(week))} ingresos · ${moneyARS(expense(week))} egresos`}
              icon={net(week) >= 0 ? TrendingUp : TrendingDown}
            />
            <KpiCard
              label="Mes"
              value={moneyARS(net(month))}
              hint={`${moneyARS(income(month))} ingresos · ${moneyARS(expense(month))} egresos`}
              icon={net(month) >= 0 ? TrendingUp : TrendingDown}
            />
          </div>
        </div>

        {/* Quick actions (mini cards) */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card>
            <CardHeader title="Acciones rápidas" />
            <CardBody>
              <div className="grid gap-2">
                <Link href="/admin/finance/movements" className="group flex items-center justify-between rounded-xl border px-3 py-2 text-sm hover:bg-zinc-50">
                  <span className="font-semibold text-zinc-900">Ir a movimientos</span>
                  <ArrowRight className="h-4 w-4 text-zinc-400 transition group-hover:translate-x-0.5" />
                </Link>
                <Link href="/admin/finance/stats" className="group flex items-center justify-between rounded-xl border px-3 py-2 text-sm hover:bg-zinc-50">
                  <span className="font-semibold text-zinc-900">Ver estadísticas</span>
                  <ArrowRight className="h-4 w-4 text-zinc-400 transition group-hover:translate-x-0.5" />
                </Link>
                <Link href="/admin/finance/closings" className="group flex items-center justify-between rounded-xl border px-3 py-2 text-sm hover:bg-zinc-50">
                  <span className="font-semibold text-zinc-900">Gestionar cierres</span>
                  <ArrowRight className="h-4 w-4 text-zinc-400 transition group-hover:translate-x-0.5" />
                </Link>
              </div>
              <div className="mt-3 text-xs text-zinc-500">
                Tip: si un día está <b>LOCKED</b>, solo <b>ADMIN</b> puede modificar movimientos.
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Estado del módulo" />
            <CardBody>
              <div className="rounded-2xl border bg-zinc-50 p-3 text-sm">
                <div className="flex items-center gap-2 text-zinc-700">
                  <Lock className="h-4 w-4" />
                  <span>
                    Bloqueo por cierres: <b>activo</b>
                  </span>
                </div>
                <div className="mt-2 text-xs text-zinc-500">
                  Cierres te protegen de cambios retroactivos en caja/finance.
                </div>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Buenas prácticas" />
            <CardBody>
              <ul className="list-disc space-y-2 pl-5 text-sm text-zinc-700">
                <li>Usá categorías consistentes para comparar meses.</li>
                <li>Transferencias no afectan neto, solo mueven saldo entre cuentas.</li>
                <li>Cerrá el día al final de turno para bloquear cambios.</li>
              </ul>
            </CardBody>
          </Card>
        </div>

        {/* Main grid */}
        <Card>
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
      </div>
    </AdminProtected>
  );
}
