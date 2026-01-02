"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/app/providers/AuthProvider";
import { apiFetchAuthed } from "@/lib/apiAuthed";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import {
  RefreshCcw,
  CalendarDays,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ClipboardList,
  TrendingUp,
  BadgeDollarSign,
  ChevronDown,
  ChevronUp,
  Search,
} from "lucide-react";
import { useRouter } from "next/navigation";

function todayKeyArgentina() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Cordoba",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function moneyARS(n: number) {
  return n.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
}

function fmtTime(iso?: any) {
  const v = toIsoLike(iso);
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}

// tolerante para Date / ISO / EJSON {$date}
function toIsoLike(v: any): string | null {
  if (!v) return null;
  if (typeof v === "string") return v;
  if (typeof v === "number") return new Date(v).toISOString();
  if (typeof v === "object") {
    if (typeof v.$date === "string") return v.$date;
    if (typeof v.$date === "number") return new Date(v.$date).toISOString();
  }
  return null;
}

function fmtDateTime(v?: any) {
  const iso = toIsoLike(v);
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  });
}

function getWeekRange(dateKey: string) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const base = new Date(y, (m ?? 1) - 1, d ?? 1);
  const day = base.getDay(); // 0 Sun ... 6 Sat
  const mondayOffset = (day + 6) % 7;
  const monday = new Date(base);
  monday.setDate(base.getDate() - mondayOffset);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const toKey = (dt: Date) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Argentina/Cordoba",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(dt);

  return { from: toKey(monday), to: toKey(sunday) };
}

type MeResponse = {
  employee: {
    id: string;
    fullName: string;
    hourlyRate: number;
    isActive: boolean;
  };
};

type SummaryResponse = {
  employee: { id: string; fullName: string; hourlyRate: number };
  range: { from: string; to: string };
  totals: { totalHours: number; totalPay: number };
  items: {
    id: string;
    dateKey: string;
    checkInAt: string | null;
    checkOutAt: string | null;
    hours: number;
  }[];
};

type ProductionRow = {
  id: string;
  dateKey: string;
  at?: any; // ✅ ahora tolerante
  taskName?: string | null;
  taskId?: string | null;
  area?: string | null; // ✅ si backend lo manda
  notes?: string | null;
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function AreaPill({ area }: { area?: string | null }) {
  if (!area) return null;
  return (
    <span className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[11px] font-semibold text-zinc-700">
      {area}
    </span>
  );
}

export default function UserPanelPage() {
  const { getAccessToken, logout } = useAuth();
  const router = useRouter();

  const [dateKey, setDateKey] = useState(todayKeyArgentina());
  const week = useMemo(() => getWeekRange(dateKey), [dateKey]);

  const [me, setMe] = useState<MeResponse | null>(null);
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [prod, setProd] = useState<ProductionRow[]>([]);

  const [busy, setBusy] = useState(false);
  const [busyRefresh, setBusyRefresh] = useState(false);
  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  // UX toggles
  const [qTasks, setQTasks] = useState("");
  const [openDays, setOpenDays] = useState<Record<string, boolean>>({}); // accordion days

  async function loadAll() {
    setError(null);
    setOkMsg(null);
    setLoading(true);

    try {
      const meData = await apiFetchAuthed<MeResponse>(getAccessToken, "/me");
      setMe(meData);

      const sum = await apiFetchAuthed<SummaryResponse>(
        getAccessToken,
        `/me/attendance/summary?from=${encodeURIComponent(
          week.from
        )}&to=${encodeURIComponent(week.to)}`
      );
      setSummary(sum);

      const p = await apiFetchAuthed<ProductionRow[]>(
        getAccessToken,
        `/me/production?from=${encodeURIComponent(
          week.from
        )}&to=${encodeURIComponent(week.to)}&limit=200`
      );
      setProd(p);
    } catch (e: any) {
      setError(e?.message || "Error cargando panel");
    } finally {
      setLoading(false);
    }
  }

  async function refreshWeekOnly() {
    setError(null);
    setOkMsg(null);
    setBusyRefresh(true);
    try {
      const sum = await apiFetchAuthed<SummaryResponse>(
        getAccessToken,
        `/me/attendance/summary?from=${encodeURIComponent(
          week.from
        )}&to=${encodeURIComponent(week.to)}`
      );
      setSummary(sum);

      const p = await apiFetchAuthed<ProductionRow[]>(
        getAccessToken,
        `/me/production?from=${encodeURIComponent(
          week.from
        )}&to=${encodeURIComponent(week.to)}&limit=200`
      );
      setProd(p);

      setOkMsg("Actualizado ✔");
      window.setTimeout(() => setOkMsg(null), 2500);
    } catch (e: any) {
      setError(e?.message || "Error actualizando datos");
    } finally {
      setBusyRefresh(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    refreshWeekOnly();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [week.from, week.to]);

  const todayRow = useMemo(() => {
    return summary?.items?.find((x) => x.dateKey === dateKey) ?? null;
  }, [summary, dateKey]);

  const todayStatus = useMemo(() => {
    if (!todayRow?.checkInAt) return "NO_IN";
    if (todayRow.checkInAt && !todayRow.checkOutAt) return "IN_ONLY";
    return "DONE";
  }, [todayRow]);

  const weeklyDaysSorted = useMemo(() => {
    const items = summary?.items?.slice() ?? [];
    return items.sort((a, b) => b.dateKey.localeCompare(a.dateKey));
  }, [summary]);

  async function checkIn() {
    setError(null);
    setOkMsg(null);
    setBusy(true);
    try {
      await apiFetchAuthed(getAccessToken, "/me/attendance/check-in", {
        method: "POST",
        body: JSON.stringify({ dateKey }),
      });
      await loadAll();
      setOkMsg("Entrada registrada ✔");
      window.setTimeout(() => setOkMsg(null), 2500);
    } catch (e: any) {
      setError(e?.message || "Error haciendo entrada");
    } finally {
      setBusy(false);
    }
  }

  async function checkOut() {
    setError(null);
    setOkMsg(null);
    setBusy(true);
    try {
      await apiFetchAuthed(getAccessToken, "/me/attendance/check-out", {
        method: "POST",
        body: JSON.stringify({ dateKey }),
      });
      await loadAll();
      setOkMsg("Salida registrada ✔");
      window.setTimeout(() => setOkMsg(null), 2500);
    } catch (e: any) {
      setError(e?.message || "Error haciendo salida");
    } finally {
      setBusy(false);
    }
  }

  // Agrupar tareas por día
  const prodByDay = useMemo(() => {
    const map = new Map<string, ProductionRow[]>();
    for (const r of prod) {
      const arr = map.get(r.dateKey) || [];
      arr.push(r);
      map.set(r.dateKey, arr);
    }
    const entries = [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));

    // abrir por defecto "hoy" si existe (si no, el primer día)
    const nextOpen: Record<string, boolean> = {};
    const hasToday = entries.some(([dk]) => dk === dateKey);
    const defaultKey = hasToday ? dateKey : entries[0]?.[0];
    if (defaultKey && openDays[defaultKey] === undefined) {
      nextOpen[defaultKey] = true;
    }
    if (Object.keys(nextOpen).length) {
      queueMicrotask(() => setOpenDays((prev) => ({ ...nextOpen, ...prev })));
    }

    return entries;
  }, [prod, dateKey, openDays]);

  const filteredProdByDay = useMemo(() => {
    const q = qTasks.trim().toLowerCase();
    if (!q) return prodByDay;

    return prodByDay
      .map(([dk, rows]) => {
        const filtered = rows.filter((r) => {
          const hay = `${r.taskName ?? ""} ${r.taskId ?? ""} ${r.notes ?? ""} ${
            r.area ?? ""
          }`.toLowerCase();
          return hay.includes(q);
        });
        return [dk, filtered] as const;
      })
      .filter(([, rows]) => rows.length > 0);
  }, [prodByDay, qTasks]);

  const quickStats = useMemo(() => {
    const totalTasks = prod.length;
    const daysWithWork = new Set(prod.map((p) => p.dateKey)).size;
    return { totalTasks, daysWithWork };
  }, [prod]);

  function taskLabel(r: ProductionRow) {
    // ✅ backend ideal: taskName viene poblado
    const name = (r.taskName ?? "").trim();
    if (name) return name;
    // fallback: mostrar un label humano si solo hay id
    const id = (r.taskId ?? "").trim();
    return id ? `Tarea (${id.slice(0, 6)}…${id.slice(-4)})` : "—";
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Top Gourmetify Header */}
      <div className="sticky top-0 z-20 border-b border-zinc-200 bg-white/85 backdrop-blur">
        <div className="mx-auto max-w-5xl px-4 py-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            {/* Left */}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold text-zinc-900 md:text-2xl">
                  Mi Panel
                </h1>

                {!loading && (
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold",
                      todayStatus === "DONE"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : todayStatus === "IN_ONLY"
                        ? "border-amber-200 bg-amber-50 text-amber-800"
                        : "border-zinc-200 bg-zinc-50 text-zinc-600"
                    )}
                  >
                    {todayStatus === "DONE" ? (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        Día completo
                      </>
                    ) : todayStatus === "IN_ONLY" ? (
                      <>
                        <AlertTriangle className="h-4 w-4" />
                        Falta salida
                      </>
                    ) : (
                      <>
                        <Clock className="h-4 w-4" />
                        Sin entrada
                      </>
                    )}
                  </span>
                )}

                <span className="inline-flex items-center gap-1 text-xs text-zinc-500">
                  <CalendarDays className="h-4 w-4" />
                  Semana: {week.from} → {week.to}
                </span>
              </div>

              <p className="mt-1 text-sm text-zinc-500">
                {me ? (
                  <>
                    Hola{" "}
                    <span className="font-semibold text-zinc-800">
                      {me.employee.fullName}
                    </span>
                    . Registrá entrada/salida y revisá tus tareas de la semana.
                  </>
                ) : (
                  "Entrada / salida + horas y tareas (solo tus datos)."
                )}
              </p>

              {(error || okMsg) && (
                <div className="mt-3 grid gap-2">
                  {error && (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                      {error}
                    </div>
                  )}
                  {okMsg && (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                      {okMsg}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right actions */}
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-[220px]">
                <Field label="Día">
                  <Input
                    type="date"
                    value={dateKey}
                    onChange={(e) => setDateKey(e.target.value)}
                  />
                </Field>
              </div>

              <Button
                variant="secondary"
                onClick={async () => {
                  setBusyRefresh(true);
                  try {
                    await loadAll();
                    setOkMsg("Actualizado ✔");
                    window.setTimeout(() => setOkMsg(null), 2200);
                  } finally {
                    setBusyRefresh(false);
                  }
                }}
                disabled={busy || busyRefresh}
                loading={busyRefresh}
              >
                <span className="inline-flex items-center gap-2">
                  <RefreshCcw className="h-4 w-4" />
                  Actualizar
                </span>
              </Button>

              <Button
                variant="danger"
                onClick={async () => {
                  setBusy(true);
                  try {
                    await logout();
                  } finally {
                    router.replace("/login");
                  }
                }}
                disabled={busy || busyRefresh}
                loading={busy}
              >
                Cerrar sesión
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-5xl px-4 py-6 pb-28 space-y-6">
        {/* Today — action cards */}
        <div className="grid gap-4 md:grid-cols-12">
          <div className="md:col-span-8">
            <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-zinc-900">
                    Hoy • {dateKey}
                  </div>
                  <div className="mt-1 text-sm text-zinc-500">
                    Registrá tu jornada. Si falta salida, te lo marca.
                  </div>
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-semibold text-zinc-700">
                  {todayStatus === "DONE"
                    ? "OK"
                    : todayStatus === "IN_ONLY"
                    ? "Pendiente"
                    : "Sin registro"}
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                  <div className="text-xs text-zinc-500">Entrada</div>
                  <div className="mt-1 text-lg font-bold text-zinc-900">
                    {fmtTime(todayRow?.checkInAt ?? null)}
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                  <div className="text-xs text-zinc-500">Salida</div>
                  <div className="mt-1 text-lg font-bold text-zinc-900">
                    {fmtTime(todayRow?.checkOutAt ?? null)}
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                  <div className="text-xs text-zinc-500">Horas hoy</div>
                  <div className="mt-1 text-lg font-bold text-zinc-900">
                    {todayRow ? `${todayRow.hours} h` : "—"}
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  onClick={checkIn}
                  disabled={busy || !!todayRow?.checkInAt}
                  loading={busy}
                >
                  Marcar Entrada
                </Button>

                <Button
                  variant="secondary"
                  onClick={checkOut}
                  disabled={
                    busy || !todayRow?.checkInAt || !!todayRow?.checkOutAt
                  }
                  loading={busy}
                >
                  Marcar Salida
                </Button>
              </div>

              <div className="mt-3 text-xs text-zinc-500">
                * Si tu usuario no está vinculado a un empleado, pedile al ADMIN
                que lo vincule.
              </div>
            </div>
          </div>

          {/* Weekly summary */}
          <div className="md:col-span-4">
            <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="text-sm font-semibold text-zinc-900">
                Mi semana
              </div>
              <div className="mt-1 text-sm text-zinc-500">
                {week.from} → {week.to}
              </div>

              <div className="mt-4 grid gap-3">
                <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                  <div className="flex items-center gap-2 text-xs text-zinc-500">
                    <TrendingUp className="h-4 w-4" />
                    Horas
                  </div>
                  <div className="mt-1 text-2xl font-extrabold text-zinc-900">
                    {summary ? `${summary.totals.totalHours} h` : "—"}
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                  <div className="flex items-center gap-2 text-xs text-zinc-500">
                    <BadgeDollarSign className="h-4 w-4" />
                    Total estimado
                  </div>
                  <div className="mt-1 text-2xl font-extrabold text-zinc-900">
                    {summary ? moneyARS(summary.totals.totalPay) : "—"}
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">
                    Tarifa:{" "}
                    <span className="font-semibold text-zinc-700">
                      {summary ? moneyARS(summary.employee.hourlyRate) : "—"} /
                      hora
                    </span>
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-600">Días con tareas</span>
                    <span className="font-semibold text-zinc-900">
                      {quickStats.daysWithWork}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span className="text-zinc-600">Tareas</span>
                    <span className="font-semibold text-zinc-900">
                      {quickStats.totalTasks}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Week days: hours per day */}
        <Card>
          <CardHeader title="Detalle de días" subtitle="Horas por día (semana)" />
          <CardBody>
            {!summary ? (
              <div className="text-sm text-zinc-500">Cargando…</div>
            ) : summary.items.length === 0 ? (
              <div className="text-sm text-zinc-500">No hay registros.</div>
            ) : (
              <div className="grid gap-2">
                {weeklyDaysSorted.map((it) => {
                  const hasIn = !!it.checkInAt;
                  const hasOut = !!it.checkOutAt;
                  const pending = hasIn && !hasOut;

                  return (
                    <div
                      key={it.id}
                      className={cn(
                        "rounded-2xl border p-4",
                        pending
                          ? "border-amber-200 bg-amber-50"
                          : "border-zinc-200 bg-white"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <div className="text-sm font-semibold text-zinc-900">
                              {it.dateKey}
                            </div>
                            {pending && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                                <AlertTriangle className="h-3.5 w-3.5" />
                                Falta salida
                              </span>
                            )}
                          </div>
                          <div className="mt-1 text-xs text-zinc-500">
                            {fmtTime(it.checkInAt)} → {fmtTime(it.checkOutAt)}
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-sm font-semibold text-zinc-900">
                            {it.hours} h
                          </div>
                          <div className="mt-1 h-2 w-28 overflow-hidden rounded-full bg-zinc-100">
                            <div
                              className="h-full bg-zinc-900"
                              style={{
                                width: `${Math.min(
                                  100,
                                  (Math.max(0, it.hours) / 12) * 100
                                )}%`,
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardBody>
        </Card>

        {/* Tasks section */}
        <div className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm">
          <div className="border-b border-zinc-100 px-5 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold text-zinc-900">
                    Mis tareas
                  </h2>
                  <span className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-xs font-semibold text-zinc-700">
                    <ClipboardList className="h-4 w-4" />
                    {filteredProdByDay.reduce(
                      (acc, [, rows]) => acc + rows.length,
                      0
                    )}{" "}
                    items
                  </span>
                </div>
                <p className="mt-1 text-sm text-zinc-500">
                  Producción registrada por día.
                </p>
              </div>

              <div className="w-full sm:w-80">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                  <Input
                    value={qTasks}
                    onChange={(e) => setQTasks(e.target.value)}
                    placeholder="Buscar por tarea o notas…"
                    className="pl-9"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="p-5 space-y-4">
            {loading ? (
              <div className="text-sm text-zinc-500">Cargando…</div>
            ) : filteredProdByDay.length === 0 ? (
              <div className="text-sm text-zinc-500">
                No hay tareas registradas en este rango.
              </div>
            ) : (
              filteredProdByDay.map(([dk, rows]) => {
                const isOpen = openDays[dk] ?? false;

                return (
                  <div
                    key={dk}
                    className="rounded-3xl border border-zinc-200 overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setOpenDays((prev) => ({ ...prev, [dk]: !isOpen }))
                      }
                      className="w-full px-4 py-3 bg-zinc-50 border-b border-zinc-200 flex items-center justify-between hover:bg-zinc-50/70"
                    >
                      <div className="text-left">
                        <div className="text-sm font-semibold text-zinc-900">
                          {dk}
                        </div>
                        <div className="mt-0.5 text-xs text-zinc-500">
                          {rows.length} tareas
                        </div>
                      </div>
                      <div className="text-zinc-600">
                        {isOpen ? (
                          <ChevronUp className="h-5 w-5" />
                        ) : (
                          <ChevronDown className="h-5 w-5" />
                        )}
                      </div>
                    </button>

                    <div
                      className={cn(
                        "transition-[max-height,opacity] duration-300 ease-out overflow-hidden",
                        isOpen
                          ? "max-h-[900px] opacity-100"
                          : "max-h-0 opacity-0"
                      )}
                    >
                      <div className="overflow-x-auto">
                        <table className="min-w-full">
                          <thead className="bg-white">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                                Hora
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                                Tarea
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                                Notas
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-100">
                            {rows
                              .slice()
                              // ✅ ordenar por fecha real si existe, si no por string
                              .sort((a, b) => {
                                const ta = new Date(toIsoLike(a.at) ?? 0).getTime();
                                const tb = new Date(toIsoLike(b.at) ?? 0).getTime();
                                if (Number.isFinite(tb - ta) && (tb - ta) !== 0) return tb - ta;
                                return String(b.at ?? "").localeCompare(String(a.at ?? ""));
                              })
                              .map((r) => (
                                <tr key={r.id} className="hover:bg-zinc-50/60">
                                  <td className="px-4 py-3 text-sm text-zinc-700 whitespace-nowrap">
                                    {fmtDateTime(r.at)}
                                  </td>

                                  <td className="px-4 py-3">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <div className="text-sm font-semibold text-zinc-900">
                                        {taskLabel(r)}
                                      </div>
                                      <AreaPill area={r.area ?? null} />
                                    </div>

                                    {/* ✅ si no hay taskName y sólo hay id, mostrás el id completo en chiquito */}
                                    {!((r.taskName ?? "").trim()) && (r.taskId ?? "").trim() && (
                                      <div className="mt-0.5 text-xs text-zinc-500">
                                        ID: {r.taskId}
                                      </div>
                                    )}
                                  </td>

                                  <td className="px-4 py-3 text-sm text-zinc-700">
                                    {r.notes?.trim() ? r.notes : "—"}
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Sticky Bottom Bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-200 bg-white/90 backdrop-blur">
        <div className="mx-auto max-w-5xl px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-zinc-600">
              <span className="font-semibold text-zinc-900">{dateKey}</span>{" "}
              <span className="text-zinc-400">·</span>{" "}
              <span className="text-zinc-600">
                {todayStatus === "DONE"
                  ? "Día completo"
                  : todayStatus === "IN_ONLY"
                  ? "Falta salida"
                  : "Sin entrada"}
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                onClick={checkIn}
                disabled={busy || !!todayRow?.checkInAt}
                loading={busy}
              >
                Entrada
              </Button>
              <Button
                variant="secondary"
                onClick={checkOut}
                disabled={busy || !todayRow?.checkInAt || !!todayRow?.checkOutAt}
                loading={busy}
              >
                Salida
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
