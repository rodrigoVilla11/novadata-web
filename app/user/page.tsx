"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
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
  Plus,
} from "lucide-react";
import { useRouter } from "next/navigation";

// ============================================================================
// Helpers
// ============================================================================
function todayKeyArgentina() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Cordoba",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function moneyARS(n: any) {
  const v = Number(n ?? 0) || 0;
  return v.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
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

function toTimeMs(v: any): number {
  const iso = toIsoLike(v);
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : 0;
}

function fmtTime(v?: any) {
  const iso = toIsoLike(v);
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
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

// ============================================================================
// Types
// ============================================================================
type MeResponse = {
  employee: { id: string; fullName: string; hourlyRate: number; isActive: boolean };
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

type ProductionStatus = "PENDING" | "DONE";

type ProductionNote = {
  text: string;
  createdAt: string | null;
  createdBy: string | null;
  createdByName?: string | null;
};

type ProductionRow = {
  id: string;
  dateKey: string;
  at?: any;
  performedAt?: any;
  time?: string | null;

  status?: ProductionStatus;
  isDone?: boolean;
  doneAt?: string | null;

  taskName?: string | null;
  taskId?: string | null;
  area?: string | null;

  notes?: ProductionNote[];
};

// ============================================================================
// Tiny UI
// ============================================================================
function AreaPill({ area }: { area?: string | null }) {
  if (!area) return null;
  return (
    <span className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[11px] font-semibold text-zinc-700">
      {area}
    </span>
  );
}

function lastNoteText(notes?: ProductionNote[]) {
  if (!Array.isArray(notes) || notes.length === 0) return "";
  return String(notes[notes.length - 1]?.text ?? "").trim();
}

export default function UserPanelPage() {
  const { getAccessToken, logout } = useAuth();
  const router = useRouter();

  const [dateKey, setDateKey] = useState(todayKeyArgentina());
  const week = useMemo(() => getWeekRange(dateKey), [dateKey]);

  const [me, setMe] = useState<MeResponse | null>(null);
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [prod, setProd] = useState<ProductionRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [busyRefresh, setBusyRefresh] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const okTimerRef = useRef<number | null>(null);

  function flashOk(msg: string) {
    setOkMsg(msg);
    if (okTimerRef.current) window.clearTimeout(okTimerRef.current);
    okTimerRef.current = window.setTimeout(() => setOkMsg(null), 2200);
  }

  // UX toggles
  const [qTasks, setQTasks] = useState("");
  const [openDays, setOpenDays] = useState<Record<string, boolean>>({});

  // per-row note/done
  const [noteDraftById, setNoteDraftById] = useState<Record<string, string>>({});
  const [noteBusyId, setNoteBusyId] = useState<string | null>(null);
  const [doneBusyId, setDoneBusyId] = useState<string | null>(null);

  // acordeón por fila (notas)
  const [openNotesByRow, setOpenNotesByRow] = useState<Record<string, boolean>>({});

  // acción checkin/checkout separada (para no bloquear todo por UI)
  const [attendanceBusy, setAttendanceBusy] = useState<"IN" | "OUT" | null>(null);
  const [logoutBusy, setLogoutBusy] = useState(false);

  async function loadAll() {
    setError(null);
    setLoading(true);
    try {
      const meData = await apiFetchAuthed<MeResponse>(getAccessToken, "/me");
      setMe(meData);

      const [sum, p] = await Promise.all([
        apiFetchAuthed<SummaryResponse>(
          getAccessToken,
          `/me/attendance/summary?from=${encodeURIComponent(week.from)}&to=${encodeURIComponent(week.to)}`
        ),
        apiFetchAuthed<ProductionRow[]>(
          getAccessToken,
          `/me/production?from=${encodeURIComponent(week.from)}&to=${encodeURIComponent(week.to)}&limit=200`
        ),
      ]);

      setSummary(sum);
      setProd(
        Array.isArray(p)
          ? p.map((r: any) => ({ ...r, notes: Array.isArray(r.notes) ? r.notes : [] }))
          : []
      );
    } catch (e: any) {
      setError(e?.message || "Error cargando panel");
    } finally {
      setLoading(false);
    }
  }

  async function refreshWeekOnly() {
    setError(null);
    setBusyRefresh(true);
    try {
      const [sum, p] = await Promise.all([
        apiFetchAuthed<SummaryResponse>(
          getAccessToken,
          `/me/attendance/summary?from=${encodeURIComponent(week.from)}&to=${encodeURIComponent(week.to)}`
        ),
        apiFetchAuthed<ProductionRow[]>(
          getAccessToken,
          `/me/production?from=${encodeURIComponent(week.from)}&to=${encodeURIComponent(week.to)}&limit=200`
        ),
      ]);

      setSummary(sum);
      setProd(
        Array.isArray(p)
          ? p.map((r: any) => ({ ...r, notes: Array.isArray(r.notes) ? r.notes : [] }))
          : []
      );

      flashOk("Actualizado ✔");
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

  // cuando cambia semana, refrescamos SOLO semana (no /me)
  useEffect(() => {
    if (!summary && loading) return; // primer loadAll ya lo hace
    refreshWeekOnly();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [week.from, week.to]);

  const todayRow = useMemo(() => summary?.items?.find((x) => x.dateKey === dateKey) ?? null, [summary, dateKey]);

  const todayStatus = useMemo(() => {
    if (!todayRow?.checkInAt) return "NO_IN" as const;
    if (todayRow.checkInAt && !todayRow.checkOutAt) return "IN_ONLY" as const;
    return "DONE" as const;
  }, [todayRow]);

  const weeklyDaysSorted = useMemo(() => {
    const items = summary?.items?.slice() ?? [];
    return items.sort((a, b) => b.dateKey.localeCompare(a.dateKey));
  }, [summary]);

  async function checkIn() {
    setError(null);
    setAttendanceBusy("IN");
    try {
      await apiFetchAuthed(getAccessToken, "/me/attendance/check-in", {
        method: "POST",
        body: JSON.stringify({ dateKey }),
      });
      await refreshWeekOnly();
      flashOk("Entrada registrada ✔");
    } catch (e: any) {
      setError(e?.message || "Error haciendo entrada");
    } finally {
      setAttendanceBusy(null);
    }
  }

  async function checkOut() {
    setError(null);
    setAttendanceBusy("OUT");
    try {
      await apiFetchAuthed(getAccessToken, "/me/attendance/check-out", {
        method: "POST",
        body: JSON.stringify({ dateKey }),
      });
      await refreshWeekOnly();
      flashOk("Salida registrada ✔");
    } catch (e: any) {
      setError(e?.message || "Error haciendo salida");
    } finally {
      setAttendanceBusy(null);
    }
  }

  // marcar hecha/pendiente
  async function toggleDone(r: ProductionRow) {
    const wasDone = Boolean(r.isDone) || r.status === "DONE";
    const next = !wasDone;

    setError(null);
    setDoneBusyId(r.id);

    // optimista
    setProd((prev) =>
      prev.map((p) =>
        p.id === r.id
          ? { ...p, isDone: next, status: next ? "DONE" : "PENDING", doneAt: next ? new Date().toISOString() : null }
          : p
      )
    );

    try {
      await apiFetchAuthed(getAccessToken, `/production/${r.id}/done`, {
        method: "PATCH",
        body: JSON.stringify({ done: next }),
      });
      await refreshWeekOnly();
      flashOk(next ? "Tarea marcada como hecha ✔" : "Tarea marcada como pendiente ✔");
    } catch (e: any) {
      // rollback
      setProd((prev) =>
        prev.map((p) =>
          p.id === r.id
            ? { ...p, isDone: wasDone, status: wasDone ? "DONE" : "PENDING", doneAt: wasDone ? p.doneAt ?? new Date().toISOString() : null }
            : p
        )
      );
      setError(e?.message || "Error marcando estado");
    } finally {
      setDoneBusyId(null);
    }
  }

  // agregar nota
  async function addNote(rowId: string) {
    const text = (noteDraftById[rowId] ?? "").trim();
    if (!text) return;

    setError(null);
    setNoteBusyId(rowId);
    try {
      await apiFetchAuthed(getAccessToken, `/production/${rowId}/notes`, {
        method: "POST",
        body: JSON.stringify({ text }),
      });

      setNoteDraftById((m) => ({ ...m, [rowId]: "" }));
      setOpenNotesByRow((m) => ({ ...m, [rowId]: true }));

      await refreshWeekOnly();
      flashOk("Nota agregada ✔");
    } catch (e: any) {
      setError(e?.message || "Error agregando nota");
    } finally {
      setNoteBusyId(null);
    }
  }

  // agrupar tareas por día
  const prodByDay = useMemo(() => {
    const map = new Map<string, ProductionRow[]>();
    for (const r of prod) {
      const arr = map.get(r.dateKey) || [];
      arr.push(r);
      map.set(r.dateKey, arr);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [prod]);

  // abrir por defecto (hoy si existe, sino el primer día) — una sola vez por semana/data
  useEffect(() => {
    if (prodByDay.length === 0) return;
    const hasToday = prodByDay.some(([dk]) => dk === dateKey);
    const defaultKey = hasToday ? dateKey : prodByDay[0]?.[0];
    if (!defaultKey) return;

    setOpenDays((prev) => {
      // si ya hay algún abierto, no tocamos
      if (Object.values(prev).some(Boolean)) return prev;
      return { ...prev, [defaultKey]: true };
    });
  }, [prodByDay, dateKey]);

  const filteredProdByDay = useMemo(() => {
    const q = qTasks.trim().toLowerCase();
    if (!q) return prodByDay;

    return prodByDay
      .map(([dk, rows]) => {
        const filtered = rows.filter((r) => {
          const notesText = (r.notes || []).map((n) => n.text).join(" ");
          const hay = `${r.taskName ?? ""} ${r.taskId ?? ""} ${notesText} ${r.area ?? ""} ${r.status ?? ""}`.toLowerCase();
          return hay.includes(q);
        });
        return [dk, filtered] as const;
      })
      .filter(([, rows]) => rows.length > 0);
  }, [prodByDay, qTasks]);

  const quickStats = useMemo(() => {
    const totalTasks = prod.length;
    const daysWithWork = new Set(prod.map((p) => p.dateKey)).size;
    const done = prod.filter((p) => Boolean(p.isDone) || p.status === "DONE").length;
    return { totalTasks, daysWithWork, done };
  }, [prod]);

  function taskLabel(r: ProductionRow) {
    const name = (r.taskName ?? "").trim();
    if (name) return name;
    const id = (r.taskId ?? "").trim();
    return id ? `Tarea (${id.slice(0, 6)}…${id.slice(-4)})` : "—";
  }

  function rowMoment(r: ProductionRow) {
    return r.performedAt ?? r.at ?? null;
  }

  function rowTimeLabel(r: ProductionRow) {
    const t = String(r.time ?? "").trim();
    if (t) return t;
    return fmtTime(rowMoment(r));
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Header */}
      <div className="sticky top-0 z-20 border-b border-zinc-200 bg-white/85 backdrop-blur">
        <div className="mx-auto max-w-5xl px-4 py-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold text-zinc-900 md:text-2xl">Mi Panel</h1>

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
                    <span className="font-semibold text-zinc-800">{me.employee.fullName}</span>. Registrá entrada/salida y revisá tus tareas.
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

            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-55">
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
                onClick={refreshWeekOnly}
                disabled={busyRefresh || attendanceBusy !== null}
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
                  setLogoutBusy(true);
                  try {
                    await logout();
                    router.replace("/login");
                  } finally {
                    setLogoutBusy(false);
                  }
                }}
                disabled={logoutBusy}
                loading={logoutBusy}
              >
                Cerrar sesión
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-5xl px-4 py-6 pb-28 space-y-6">
        {/* Today cards */}
        <div className="grid gap-4 md:grid-cols-12">
          <div className="md:col-span-8">
            <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-zinc-900">Hoy • {dateKey}</div>
                  <div className="mt-1 text-sm text-zinc-500">Registrá tu jornada.</div>
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-semibold text-zinc-700">
                  {todayStatus === "DONE" ? "OK" : todayStatus === "IN_ONLY" ? "Pendiente" : "Sin registro"}
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                  <div className="text-xs text-zinc-500">Entrada</div>
                  <div className="mt-1 text-lg font-bold text-zinc-900">{fmtTime(todayRow?.checkInAt ?? null)}</div>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                  <div className="text-xs text-zinc-500">Salida</div>
                  <div className="mt-1 text-lg font-bold text-zinc-900">{fmtTime(todayRow?.checkOutAt ?? null)}</div>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                  <div className="text-xs text-zinc-500">Horas hoy</div>
                  <div className="mt-1 text-lg font-bold text-zinc-900">{todayRow ? `${todayRow.hours} h` : "—"}</div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  onClick={checkIn}
                  disabled={attendanceBusy !== null || !!todayRow?.checkInAt}
                  loading={attendanceBusy === "IN"}
                >
                  Marcar Entrada
                </Button>

                <Button
                  variant="secondary"
                  onClick={checkOut}
                  disabled={attendanceBusy !== null || !todayRow?.checkInAt || !!todayRow?.checkOutAt}
                  loading={attendanceBusy === "OUT"}
                >
                  Marcar Salida
                </Button>
              </div>

              <div className="mt-3 text-xs text-zinc-500">
                * Si tu usuario no está vinculado a un empleado, pedile al ADMIN que lo vincule.
              </div>
            </div>
          </div>

          {/* Weekly summary */}
          <div className="md:col-span-4">
            <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="text-sm font-semibold text-zinc-900">Mi semana</div>
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
                      {summary ? moneyARS(summary.employee.hourlyRate) : "—"} / hora
                    </span>
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-600">Días con tareas</span>
                    <span className="font-semibold text-zinc-900">{quickStats.daysWithWork}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span className="text-zinc-600">Tareas</span>
                    <span className="font-semibold text-zinc-900">{quickStats.totalTasks}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span className="text-zinc-600">Hechas</span>
                    <span className="font-semibold text-zinc-900">{quickStats.done}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Week days */}
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
                        pending ? "border-amber-200 bg-amber-50" : "border-zinc-200 bg-white"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <div className="text-sm font-semibold text-zinc-900">{it.dateKey}</div>
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
                          <div className="text-sm font-semibold text-zinc-900">{it.hours} h</div>
                          <div className="mt-1 h-2 w-28 overflow-hidden rounded-full bg-zinc-100">
                            <div
                              className="h-full bg-zinc-900"
                              style={{
                                width: `${Math.min(100, (Math.max(0, it.hours) / 12) * 100)}%`,
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
                  <h2 className="text-lg font-semibold text-zinc-900">Mis tareas</h2>
                  <span className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-xs font-semibold text-zinc-700">
                    <ClipboardList className="h-4 w-4" />
                    {filteredProdByDay.reduce((acc, [, rows]) => acc + rows.length, 0)} items
                  </span>
                </div>
                <p className="mt-1 text-sm text-zinc-500">Podés marcar hechas y agregar notas.</p>
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

          <div className="space-y-4 p-5">
            {loading ? (
              <div className="text-sm text-zinc-500">Cargando…</div>
            ) : filteredProdByDay.length === 0 ? (
              <div className="text-sm text-zinc-500">No hay tareas registradas en este rango.</div>
            ) : (
              filteredProdByDay.map(([dk, rows]) => {
                const isOpen = openDays[dk] ?? false;

                return (
                  <div key={dk} className="overflow-hidden rounded-3xl border border-zinc-200">
                    <button
                      type="button"
                      onClick={() => setOpenDays((prev) => ({ ...prev, [dk]: !isOpen }))}
                      className="flex w-full items-center justify-between border-b border-zinc-200 bg-zinc-50 px-4 py-3 hover:bg-zinc-50/70"
                    >
                      <div className="text-left">
                        <div className="text-sm font-semibold text-zinc-900">{dk}</div>
                        <div className="mt-0.5 text-xs text-zinc-500">{rows.length} tareas</div>
                      </div>
                      <div className="text-zinc-600">{isOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}</div>
                    </button>

                    {/* ✅ accordion sin max-height fijo */}
                    <div
                      className={cn(
                        "grid transition-[grid-template-rows,opacity] duration-300 ease-out",
                        isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                      )}
                    >
                      <div className="overflow-hidden">
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
                                  Estado
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                                  Notas
                                </th>
                              </tr>
                            </thead>

                            <tbody className="divide-y divide-zinc-100">
                              {rows
                                .slice()
                                .sort((a, b) => toTimeMs(rowMoment(b)) - toTimeMs(rowMoment(a)))
                                .map((r) => {
                                  const isDone = Boolean(r.isDone) || r.status === "DONE";
                                  const notes = Array.isArray(r.notes) ? r.notes : [];
                                  const count = notes.length;
                                  const last = lastNoteText(notes);
                                  const isNotesOpen = Boolean(openNotesByRow[r.id]);

                                  return (
                                    <tr key={r.id} className="align-top hover:bg-zinc-50/60">
                                      <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-700">
                                        <div className="font-semibold text-zinc-900">{rowTimeLabel(r)}</div>
                                        <div className="text-xs text-zinc-500">{fmtDateTime(rowMoment(r))}</div>
                                      </td>

                                      <td className="px-4 py-3">
                                        <div className="flex flex-wrap items-center gap-2">
                                          <div className="text-sm font-semibold text-zinc-900">{taskLabel(r)}</div>
                                          <AreaPill area={r.area ?? null} />
                                        </div>

                                        {!(r.taskName ?? "").trim() && (r.taskId ?? "").trim() && (
                                          <div className="mt-0.5 text-xs text-zinc-500">ID: {r.taskId}</div>
                                        )}
                                      </td>

                                      <td className="px-4 py-3">
                                        <div className="flex flex-col gap-2">
                                          <span
                                            className={cn(
                                              "inline-flex w-fit items-center rounded-full border px-2.5 py-1 text-xs font-semibold",
                                              isDone
                                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                                : "border-zinc-200 bg-zinc-50 text-zinc-700"
                                            )}
                                          >
                                            {isDone ? "HECHA" : "PENDIENTE"}
                                          </span>

                                          <Button
                                            disabled={doneBusyId === r.id}
                                            loading={doneBusyId === r.id}
                                            onClick={() => toggleDone(r)}
                                          >
                                            {isDone ? "Marcar pendiente" : "Marcar hecha"}
                                          </Button>
                                        </div>
                                      </td>

                                      <td className="px-4 py-3 text-sm text-zinc-700">
                                        <div className="space-y-2">
                                          <div className="flex items-center justify-between gap-2">
                                            <div className="text-xs text-zinc-500">
                                              {count > 0 ? `${count} nota${count === 1 ? "" : "s"}` : "Sin notas"}
                                            </div>

                                            {count > 0 && (
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  setOpenNotesByRow((m) => ({
                                                    ...m,
                                                    [r.id]: !Boolean(m[r.id]),
                                                  }))
                                                }
                                                className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-700 hover:text-zinc-900"
                                              >
                                                {isNotesOpen ? (
                                                  <>
                                                    Ocultar <ChevronUp className="h-4 w-4" />
                                                  </>
                                                ) : (
                                                  <>
                                                    Ver todas <ChevronDown className="h-4 w-4" />
                                                  </>
                                                )}
                                              </button>
                                            )}
                                          </div>

                                          {count > 0 && !isNotesOpen && (
                                            <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
                                              {last || "—"}
                                            </div>
                                          )}

                                          {count > 0 && isNotesOpen && (
                                            <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2">
                                              <ul className="space-y-2">
                                                {notes.map((n, idx) => (
                                                  <li key={idx} className="text-sm text-zinc-800">
                                                    <div className="flex items-center justify-between gap-2">
                                                      <span className="font-semibold text-zinc-900">
                                                        {n.createdByName ?? "—"}
                                                      </span>
                                                      <span className="text-xs text-zinc-500">
                                                        {n.createdAt ? fmtDateTime(n.createdAt) : "—"}
                                                      </span>
                                                    </div>
                                                    <div className="mt-1 whitespace-pre-wrap text-zinc-700">{n.text}</div>
                                                  </li>
                                                ))}
                                              </ul>
                                            </div>
                                          )}

                                          <div className="flex items-center gap-2">
                                            <Input
                                              value={noteDraftById[r.id] ?? ""}
                                              onChange={(e) =>
                                                setNoteDraftById((m) => ({
                                                  ...m,
                                                  [r.id]: e.target.value,
                                                }))
                                              }
                                              placeholder="Agregar nota…"
                                              disabled={noteBusyId === r.id}
                                              onKeyDown={(e) => {
                                                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) addNote(r.id);
                                              }}
                                            />
                                            <Button
                                              variant="secondary"
                                              disabled={noteBusyId === r.id || !(noteDraftById[r.id] ?? "").trim()}
                                              loading={noteBusyId === r.id}
                                              onClick={() => addNote(r.id)}
                                            >
                                              <span className="inline-flex items-center gap-2">
                                                <Plus className="h-4 w-4" />
                                                Nota
                                              </span>
                                            </Button>
                                          </div>

                                          <div className="text-[11px] text-zinc-500">Tip: Ctrl/⌘ + Enter para guardar la nota.</div>
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                            </tbody>
                          </table>
                        </div>
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
                {todayStatus === "DONE" ? "Día completo" : todayStatus === "IN_ONLY" ? "Falta salida" : "Sin entrada"}
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={checkIn} disabled={attendanceBusy !== null || !!todayRow?.checkInAt} loading={attendanceBusy === "IN"}>
                Entrada
              </Button>
              <Button
                variant="secondary"
                onClick={checkOut}
                disabled={attendanceBusy !== null || !todayRow?.checkInAt || !!todayRow?.checkOutAt}
                loading={attendanceBusy === "OUT"}
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
