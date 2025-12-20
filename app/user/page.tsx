"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/app/providers/AuthProvider";
import { apiFetchAuthed } from "@/lib/apiAuthed";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";

// (Opcional, pero si ya los usás en el proyecto, suma mucho a UX)
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

function fmtTime(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}

function fmtDateTime(iso?: string | null) {
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
  at: string;
  taskName?: string | null;
  taskId?: string | null;
  notes?: string | null;
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function UserPanelPage() {
  const { getAccessToken, logout } = useAuth();

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
      // no romper el render: setState dentro de memo es mala práctica.
      // lo hacemos afuera con un microtask:
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
          const hay = `${r.taskName ?? ""} ${r.taskId ?? ""} ${
            r.notes ?? ""
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

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 border-b border-zinc-200 bg-white/80 backdrop-blur">
        <div className="mx-auto max-w-5xl px-4 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-zinc-900">Mi Panel</h1>

                {!loading && (
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold",
                      todayStatus === "DONE"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : todayStatus === "IN_ONLY"
                        ? "border-amber-200 bg-amber-50 text-amber-800"
                        : "border-zinc-200 bg-zinc-50 text-zinc-600"
                    )}
                  >
                    {todayStatus === "DONE" ? (
                      <span className="inline-flex items-center gap-1">
                        <CheckCircle2 className="h-4 w-4" />
                        Día completo
                      </span>
                    ) : todayStatus === "IN_ONLY" ? (
                      <span className="inline-flex items-center gap-1">
                        <AlertTriangle className="h-4 w-4" />
                        Falta salida
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        Sin entrada
                      </span>
                    )}
                  </span>
                )}

                <span className="inline-flex items-center gap-1 text-xs text-zinc-500">
                  <CalendarDays className="h-4 w-4" />
                  Semana: {week.from} → {week.to}
                </span>
              </div>

              <p className="mt-1 text-sm text-zinc-500">
                Entrada / salida + horas y tareas (solo tus datos).
              </p>
            </div>

            <div className="flex items-end gap-2">
              <Field label="Día">
                <Input
                  type="date"
                  value={dateKey}
                  onChange={(e) => setDateKey(e.target.value)}
                />
              </Field>

              <Button
                variant="secondary"
                onClick={async () => {
                  setBusyRefresh(true);
                  try {
                    await loadAll();
                    setOkMsg("Actualizado ✔");
                    window.setTimeout(() => setOkMsg(null), 2500);
                  } finally {
                    setBusyRefresh(false);
                  }
                }}
                disabled={busy || busyRefresh}
                loading={busyRefresh}
              >
                <span className="inline-flex items-center gap-2">
                  <RefreshCcw className="h-4 w-4" />
                  Refrescar
                </span>
              </Button>

              <Button variant="danger" onClick={logout} disabled={busy}>
                Cerrar sesión
              </Button>
            </div>
          </div>

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
      </div>

      <div className="mx-auto max-w-5xl px-4 py-8 space-y-6">
        {/* Hoy */}
        <Card>
          <CardHeader
            title={`Hoy (${dateKey})`}
            subtitle={
              me ? `Empleado: ${me.employee.fullName}` : "Cargando empleado…"
            }
          />
          <CardBody>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                <div className="text-xs text-zinc-500">Entrada</div>
                <div className="mt-1 text-lg font-semibold text-zinc-900">
                  {fmtTime(todayRow?.checkInAt ?? null)}
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                <div className="text-xs text-zinc-500">Salida</div>
                <div className="mt-1 text-lg font-semibold text-zinc-900">
                  {fmtTime(todayRow?.checkOutAt ?? null)}
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                <div className="text-xs text-zinc-500">Horas hoy</div>
                <div className="mt-1 text-lg font-semibold text-zinc-900">
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

            <p className="mt-3 text-xs text-zinc-500">
              *Si tu usuario no está vinculado a un empleado, pedile al ADMIN
              que lo vincule.
            </p>
          </CardBody>
        </Card>

        {/* Semana */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader
              title="Semana actual"
              subtitle={`${week.from} → ${week.to}`}
            />
            <CardBody>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                  <div className="flex items-center gap-2 text-xs text-zinc-500">
                    <TrendingUp className="h-4 w-4" />
                    Horas
                  </div>
                  <div className="mt-1 text-2xl font-bold text-zinc-900">
                    {summary ? `${summary.totals.totalHours} h` : "—"}
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                  <div className="flex items-center gap-2 text-xs text-zinc-500">
                    <BadgeDollarSign className="h-4 w-4" />
                    Total ($)
                  </div>
                  <div className="mt-1 text-2xl font-bold text-zinc-900">
                    {summary ? moneyARS(summary.totals.totalPay) : "—"}
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">
                    Tarifa:{" "}
                    {summary ? moneyARS(summary.employee.hourlyRate) : "—"} /
                    hora
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <div className="flex items-center justify-between text-sm">
                  <div className="text-zinc-600">Días con tareas</div>
                  <div className="font-semibold text-zinc-900">
                    {quickStats.daysWithWork}
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between text-sm">
                  <div className="text-zinc-600">Tareas registradas</div>
                  <div className="font-semibold text-zinc-900">
                    {quickStats.totalTasks}
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Detalle de días"
              subtitle="Horas por día (semana)"
            />
            <CardBody>
              {!summary ? (
                <div className="text-sm text-zinc-500">Cargando…</div>
              ) : summary.items.length === 0 ? (
                <div className="text-sm text-zinc-500">No hay registros.</div>
              ) : (
                <div className="space-y-2">
                  {weeklyDaysSorted.map((it) => {
                    const hasIn = !!it.checkInAt;
                    const hasOut = !!it.checkOutAt;
                    const pending = hasIn && !hasOut;

                    return (
                      <div
                        key={it.id}
                        className={cn(
                          "flex items-center justify-between rounded-xl border px-3 py-2",
                          pending
                            ? "border-amber-200 bg-amber-50"
                            : "border-zinc-200 bg-white"
                        )}
                      >
                        <div>
                          <div className="text-sm font-semibold text-zinc-900">
                            {it.dateKey}
                          </div>
                          <div className="mt-0.5 text-xs text-zinc-500">
                            {fmtTime(it.checkInAt)} → {fmtTime(it.checkOutAt)}
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-sm font-semibold text-zinc-900">
                            {it.hours} h
                          </div>
                          {pending && (
                            <div className="text-xs font-semibold text-amber-800">
                              Falta salida
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        {/* Tareas */}
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <div className="border-b border-zinc-100 px-5 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-zinc-900">
                  Mis tareas (semana)
                </h2>
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
                    className="rounded-2xl border border-zinc-200 overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setOpenDays((prev) => ({ ...prev, [dk]: !isOpen }))
                      }
                      className="w-full px-4 py-3 bg-zinc-50 border-b border-zinc-200 flex items-center justify-between"
                    >
                      <div className="text-left">
                        <div className="text-sm font-semibold text-zinc-900">
                          {dk}
                        </div>
                        <div className="text-xs text-zinc-500">
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

                    {isOpen && (
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
                              .sort((a, b) => (a.at < b.at ? 1 : -1))
                              .map((r) => (
                                <tr key={r.id} className="hover:bg-zinc-50/60">
                                  <td className="px-4 py-3 text-sm text-zinc-700">
                                    {fmtDateTime(r.at)}
                                  </td>
                                  <td className="px-4 py-3 text-sm font-semibold text-zinc-900">
                                    {r.taskName || r.taskId || "—"}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-zinc-700">
                                    {r.notes?.trim() ? r.notes : "—"}
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
