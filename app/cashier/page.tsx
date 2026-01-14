"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/app/providers/AuthProvider";
import { apiFetchAuthed } from "@/lib/apiAuthed";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Field";

import {
  RefreshCcw,
  CalendarDays,
  Clock,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  BadgeDollarSign,
  ChevronDown,
  ChevronUp,
  Search,
  ArrowDownUp,
  LogOut,
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

function moneyARS(n: number) {
  const v = Number(n ?? 0) || 0;
  return v.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
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

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

// ============================================================================
// Types (User / Me)
// ============================================================================
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

// ============================================================================
// Types (Finance stats + movements)
// ============================================================================
type PeriodType = "day"; // ✅ día nomás

type FinanceStatsResponse = {
  range: { from: string; to: string };
  totals: {
    income: number;
    expense: number;
    net: number;
    transferOut: number;
    transferIn: number;
  };
  byAccount: Array<{
    accountId: string;
    income: number;
    expense: number;
    net: number;
    transferOut: number;
    transferIn: number;
    startBalance: number;
    endBalance: number;
  }>;
  byCategory: Array<{
    categoryId: string | null;
    type: "INCOME" | "EXPENSE";
    total: number;
    count: number;
    nameSnapshot?: string | null;
  }>;
  seriesDaily: Array<{
    dateKey: string;
    income: number;
    expense: number;
    net: number;
  }>;
};

type FinanceAccountRow = {
  id: string;
  name: string;
};

type FinanceCategoryRow = {
  id: string;
  name: string;
  type: "INCOME" | "EXPENSE" | "BOTH";
};

type FinanceMovementType = "INCOME" | "EXPENSE" | "TRANSFER";

type FinanceMovementRow = {
  id: string;
  dateKey: string;
  type: FinanceMovementType;
  amount: number;
  accountId: string | null;
  toAccountId: string | null;
  categoryId: string | null;
  providerId: string | null;
  notes: string | null;
  status: "POSTED" | "VOID";
  accountNameSnapshot: string | null;
  categoryNameSnapshot: string | null;
  createdByUserId: string | null;
  createdAt?: string;
  updatedAt?: string;
};

type FinanceMovementsResponse = {
  items: FinanceMovementRow[];
  page: number;
  limit: number;
  total: number;
};

// ============================================================================
// Page
// ============================================================================
export default function CashierPanelPage() {
  const { getAccessToken, logout } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"work" | "finance">("work");

  // -------------------------
  // WORK
  // -------------------------
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

  const [qTasks, setQTasks] = useState("");
  const [openDays, setOpenDays] = useState<Record<string, boolean>>({});

  // -------------------------
  // FINANCE (DÍA)
  // -------------------------
  const [periodType] = useState<PeriodType>("day");
  const [financeDateKey, setFinanceDateKey] = useState(todayKeyArgentina());

  const [stats, setStats] = useState<FinanceStatsResponse | null>(null);
  const [accounts, setAccounts] = useState<FinanceAccountRow[]>([]);
  const [categories, setCategories] = useState<FinanceCategoryRow[]>([]);
  const [qAccounts, setQAccounts] = useState("");

  const [movs, setMovs] = useState<FinanceMovementsResponse | null>(null);
  const [movLoading, setMovLoading] = useState(false);

  const [movType, setMovType] = useState<"" | FinanceMovementType>("");
  const [movAccountId, setMovAccountId] = useState("");
  const [movCategoryId, setMovCategoryId] = useState("");
  const [movQ, setMovQ] = useState("");
  const [movPage, setMovPage] = useState(1);
  const movLimit = 30;

  function buildDayStatsUrl() {
    const sp = new URLSearchParams();
    sp.set("periodType", periodType);
    sp.set("dateKey", financeDateKey);
    return `/finance/stats?${sp.toString()}`;
  }

  function buildDayMovementsUrl() {
    const sp = new URLSearchParams();
    sp.set("from", financeDateKey);
    sp.set("to", financeDateKey);
    sp.set("limit", String(movLimit));
    sp.set("page", String(movPage));

    if (movType) sp.set("type", movType);
    if (movAccountId) sp.set("accountId", movAccountId);
    if (movCategoryId) sp.set("categoryId", movCategoryId);
    if (movQ.trim()) sp.set("q", movQ.trim());

    return `/finance/movements?${sp.toString()}`;
  }

  async function loadWork() {
    setError(null);
    setLoading(true);
    try {
      const meData = await apiFetchAuthed<MeResponse>(getAccessToken, "/me");
      setMe(meData);

      const sum = await apiFetchAuthed<SummaryResponse>(
        getAccessToken,
        `/me/attendance/summary?from=${encodeURIComponent(week.from)}&to=${encodeURIComponent(week.to)}`
      );
      setSummary(sum);

      const p = await apiFetchAuthed<ProductionRow[]>(
        getAccessToken,
        `/me/production?from=${encodeURIComponent(week.from)}&to=${encodeURIComponent(week.to)}&limit=200`
      );
      setProd(Array.isArray(p) ? p : []);
    } catch (e: any) {
      setError(e?.message || "Error cargando panel (trabajo)");
    } finally {
      setLoading(false);
    }
  }

  async function loadFinance() {
    setError(null);
    try {
      // Stats del día
      const s = await apiFetchAuthed<FinanceStatsResponse>(getAccessToken, buildDayStatsUrl());
      setStats(s);

      // Cat + cuentas
      const [acc, cats] = await Promise.all([
        apiFetchAuthed<FinanceAccountRow[]>(getAccessToken, "/finance/accounts?active=true"),
        apiFetchAuthed<FinanceCategoryRow[]>(getAccessToken, "/finance/categories?active=true"),
      ]);
      setAccounts(Array.isArray(acc) ? acc : []);
      setCategories(Array.isArray(cats) ? cats : []);

      // Movements del día
      setMovLoading(true);
      const m = await apiFetchAuthed<FinanceMovementsResponse>(getAccessToken, buildDayMovementsUrl());
      setMovs(m);
    } catch (e: any) {
      setError(e?.message || "Error cargando finanzas (día)");
    } finally {
      setMovLoading(false);
    }
  }

  async function loadAll() {
    setOkMsg(null);
    await Promise.all([loadWork(), loadFinance()]);
  }

  async function refreshAll() {
    setError(null);
    setOkMsg(null);
    setBusyRefresh(true);
    try {
      await loadAll();
      setOkMsg("Actualizado ✔");
      window.setTimeout(() => setOkMsg(null), 2500);
    } finally {
      setBusyRefresh(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // refresh trabajo cuando cambia la semana
  useEffect(() => {
    (async () => {
      try {
        const sum = await apiFetchAuthed<SummaryResponse>(
          getAccessToken,
          `/me/attendance/summary?from=${encodeURIComponent(week.from)}&to=${encodeURIComponent(week.to)}`
        );
        setSummary(sum);

        const p = await apiFetchAuthed<ProductionRow[]>(
          getAccessToken,
          `/me/production?from=${encodeURIComponent(week.from)}&to=${encodeURIComponent(week.to)}&limit=200`
        );
        setProd(Array.isArray(p) ? p : []);
      } catch (e: any) {
        setError(e?.message || "Error actualizando semana (trabajo)");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [week.from, week.to]);

  // refresh finanzas cuando cambian filtros/página/día
  useEffect(() => {
    loadFinance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [financeDateKey, movType, movAccountId, movCategoryId, movQ, movPage]);

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
      await loadWork();
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
      await loadWork();
      setOkMsg("Salida registrada ✔");
      window.setTimeout(() => setOkMsg(null), 2500);
    } catch (e: any) {
      setError(e?.message || "Error haciendo salida");
    } finally {
      setBusy(false);
    }
  }

  async function voidMovement(id: string) {
    if (!confirm("¿Anular movimiento?")) return;
    setBusy(true);
    setError(null);
    setOkMsg(null);
    try {
      await apiFetchAuthed(getAccessToken, `/finance/movements/${id}/void`, {
        method: "POST",
      });
      await loadFinance();
      setOkMsg("Movimiento anulado ✔");
      window.setTimeout(() => setOkMsg(null), 2500);
    } catch (e: any) {
      setError(e?.message || "Error anulando movimiento");
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
          const hay = `${r.taskName ?? ""} ${r.taskId ?? ""} ${(r.notes ?? "")}`.toLowerCase();
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

  // Finance helpers
  const accountNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of accounts) m.set(a.id, a.name);
    return m;
  }, [accounts]);

  const categoryNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of categories) m.set(c.id, c.name);
    return m;
  }, [categories]);

  const byAccountRows = useMemo(() => {
    const rows = stats?.byAccount ?? [];
    const qq = qAccounts.trim().toLowerCase();
    if (!qq) return rows;
    return rows.filter((r) => {
      const name = accountNameById.get(r.accountId) ?? r.accountId;
      return `${name} ${r.accountId}`.toLowerCase().includes(qq);
    });
  }, [stats, qAccounts, accountNameById]);

  const categoryRows = useMemo(() => {
    const rows = stats?.byCategory ?? [];
    return rows.slice().sort((a, b) => {
      if (a.type !== b.type) return a.type === "EXPENSE" ? -1 : 1;
      return (b.total ?? 0) - (a.total ?? 0);
    });
  }, [stats]);

  // ========================================================================
  // UI
  // ========================================================================
  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 border-b border-zinc-200 bg-white/80 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold text-zinc-900">Cashier • Panel</h1>

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
                  Semana (trabajo): {week.from} → {week.to}
                </span>
              </div>

              <p className="mt-1 text-sm text-zinc-500">Mis horas y tareas + finanzas del día.</p>
            </div>

            <div className="flex items-end gap-2">
              <Button variant="secondary" onClick={refreshAll} disabled={busy || busyRefresh} loading={busyRefresh}>
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
                <span className="inline-flex items-center gap-2">
                  <LogOut className="h-4 w-4" />
                  Salir
                </span>
              </Button>
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("work")}
              className={cn(
                "h-10 rounded-xl border px-3 text-sm font-semibold transition",
                activeTab === "work"
                  ? "border-zinc-900 bg-zinc-900 text-white"
                  : "border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50"
              )}
            >
              Mi trabajo
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("finance")}
              className={cn(
                "h-10 rounded-xl border px-3 text-sm font-semibold transition",
                activeTab === "finance"
                  ? "border-zinc-900 bg-zinc-900 text-white"
                  : "border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50"
              )}
            >
              Finanzas
            </button>
          </div>

          {(error || okMsg) && (
            <div className="mt-3 grid gap-2">
              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
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

      <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
        {/* ================================================================== */}
        {/* WORK TAB */}
        {/* ================================================================== */}
        {activeTab === "work" && (
          <>
            {/* Hoy */}
            <Card>
              <CardHeader
                title={`Hoy (${dateKey})`}
                subtitle={me ? `Empleado: ${me.employee.fullName}` : "Cargando empleado…"}
              />
              <CardBody>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                    <div className="text-xs text-zinc-500">Entrada</div>
                    <div className="mt-1 text-lg font-semibold text-zinc-900">{fmtTime(todayRow?.checkInAt ?? null)}</div>
                  </div>

                  <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                    <div className="text-xs text-zinc-500">Salida</div>
                    <div className="mt-1 text-lg font-semibold text-zinc-900">{fmtTime(todayRow?.checkOutAt ?? null)}</div>
                  </div>

                  <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                    <div className="text-xs text-zinc-500">Horas hoy</div>
                    <div className="mt-1 text-lg font-semibold text-zinc-900">{todayRow ? `${todayRow.hours} h` : "—"}</div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-end gap-3">
                  <div className="flex gap-2">
                    <Button onClick={checkIn} disabled={busy || !!todayRow?.checkInAt} loading={busy}>
                      Marcar Entrada
                    </Button>

                    <Button
                      variant="secondary"
                      onClick={checkOut}
                      disabled={busy || !todayRow?.checkInAt || !!todayRow?.checkOutAt}
                      loading={busy}
                    >
                      Marcar Salida
                    </Button>
                  </div>

                  <div className="w-full sm:w-56">
                    <Field label="Día">
                      <Input type="date" value={dateKey} onChange={(e) => setDateKey(e.target.value)} />
                    </Field>
                  </div>
                </div>

                <p className="mt-3 text-xs text-zinc-500">*Esto es EXACTAMENTE el panel USER (horas + tareas).</p>
              </CardBody>
            </Card>

            {/* Semana */}
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader title="Semana actual" subtitle={`${week.from} → ${week.to}`} />
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
                        Tarifa: {summary ? moneyARS(summary.employee.hourlyRate) : "—"} / hora
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                    <div className="flex items-center justify-between text-sm">
                      <div className="text-zinc-600">Días con tareas</div>
                      <div className="font-semibold text-zinc-900">{quickStats.daysWithWork}</div>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-sm">
                      <div className="text-zinc-600">Tareas registradas</div>
                      <div className="font-semibold text-zinc-900">{quickStats.totalTasks}</div>
                    </div>
                  </div>
                </CardBody>
              </Card>

              <Card>
                <CardHeader title="Detalle de días" subtitle="Horas por día (semana)" />
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
                              pending ? "border-amber-200 bg-amber-50" : "border-zinc-200 bg-white"
                            )}
                          >
                            <div>
                              <div className="text-sm font-semibold text-zinc-900">{it.dateKey}</div>
                              <div className="mt-0.5 text-xs text-zinc-500">
                                {fmtTime(it.checkInAt)} → {fmtTime(it.checkOutAt)}
                              </div>
                            </div>

                            <div className="text-right">
                              <div className="text-sm font-semibold text-zinc-900">{it.hours} h</div>
                              {pending && <div className="text-xs font-semibold text-amber-800">Falta salida</div>}
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
                    <h2 className="text-lg font-semibold text-zinc-900">Mis tareas (semana)</h2>
                    <p className="mt-1 text-sm text-zinc-500">Producción registrada por día.</p>
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
                  <div className="text-sm text-zinc-500">No hay tareas registradas en este rango.</div>
                ) : (
                  filteredProdByDay.map(([dk, rows]) => {
                    const isOpen = openDays[dk] ?? false;

                    return (
                      <div key={dk} className="rounded-2xl border border-zinc-200 overflow-hidden">
                        <button
                          type="button"
                          onClick={() => setOpenDays((prev) => ({ ...prev, [dk]: !isOpen }))}
                          className="w-full px-4 py-3 bg-zinc-50 border-b border-zinc-200 flex items-center justify-between"
                        >
                          <div className="text-left">
                            <div className="text-sm font-semibold text-zinc-900">{dk}</div>
                            <div className="text-xs text-zinc-500">{rows.length} tareas</div>
                          </div>
                          <div className="text-zinc-600">{isOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}</div>
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
                                      <td className="px-4 py-3 text-sm text-zinc-700">{fmtDateTime(r.at)}</td>
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
          </>
        )}

        {/* ================================================================== */}
        {/* FINANCE TAB (DÍA) */}
        {/* ================================================================== */}
        {activeTab === "finance" && (
          <>
            {/* Finance day filter */}
            <Card>
              <CardHeader
                title="Finanzas del día"
                subtitle={stats?.range ? `Rango: ${stats.range.from} → ${stats.range.to}` : "Cargando…"}
              />
              <CardBody>
                <div className="grid gap-3 lg:grid-cols-[260px_1fr] lg:items-end">
                  <Field label="Día (dateKey)">
                    <Input
                      type="date"
                      value={financeDateKey}
                      onChange={(e) => {
                        setFinanceDateKey(e.target.value);
                        setMovPage(1);
                      }}
                    />
                  </Field>

                  <Field label="Buscar cuenta (tabla por cuenta)">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                      <Input
                        className="pl-9"
                        placeholder="Efectivo / Santander / MP…"
                        value={qAccounts}
                        onChange={(e) => setQAccounts(e.target.value)}
                      />
                    </div>
                  </Field>
                </div>
              </CardBody>
            </Card>

            {/* Totals */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader title="Ingresos" subtitle="Total del día" />
                <CardBody>
                  <div className="text-2xl font-bold text-zinc-900">{stats ? moneyARS(stats.totals.income) : "—"}</div>
                </CardBody>
              </Card>

              <Card>
                <CardHeader title="Gastos" subtitle="Total del día" />
                <CardBody>
                  <div className="text-2xl font-bold text-zinc-900">{stats ? moneyARS(stats.totals.expense) : "—"}</div>
                </CardBody>
              </Card>

              <Card>
                <CardHeader title="Neto" subtitle="Ingresos - Gastos" />
                <CardBody>
                  <div
                    className={cn(
                      "text-2xl font-bold",
                      (stats?.totals.net ?? 0) >= 0 ? "text-emerald-700" : "text-red-700"
                    )}
                  >
                    {stats ? moneyARS(stats.totals.net) : "—"}
                  </div>
                </CardBody>
              </Card>

              <Card>
                <CardHeader title="Transferencias" subtitle="Internas" />
                <CardBody>
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-600">Sale</span>
                      <span className="font-semibold text-zinc-900">{stats ? moneyARS(stats.totals.transferOut) : "—"}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-600">Entra</span>
                      <span className="font-semibold text-zinc-900">{stats ? moneyARS(stats.totals.transferIn) : "—"}</span>
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-xs text-zinc-500">
                      <ArrowDownUp className="h-4 w-4" />
                      Afecta saldos por cuenta
                    </div>
                  </div>
                </CardBody>
              </Card>
            </div>

            {/* Movements */}
            <Card>
              <CardHeader title="Movimientos del día" subtitle="Ingresos / Gastos / Transferencias" />
              <CardBody>
                <div className="grid gap-3 md:grid-cols-4">
                  <Field label="Tipo">
                    <Select
                      value={movType}
                      onChange={(e) => {
                        setMovType(e.target.value as any);
                        setMovPage(1);
                      }}
                    >
                      <option value="">Todos</option>
                      <option value="INCOME">Ingreso</option>
                      <option value="EXPENSE">Gasto</option>
                      <option value="TRANSFER">Transfer</option>
                    </Select>
                  </Field>

                  <Field label="Cuenta">
                    <Select
                      value={movAccountId}
                      onChange={(e) => {
                        setMovAccountId(e.target.value);
                        setMovPage(1);
                      }}
                    >
                      <option value="">Todas</option>
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  <Field label="Categoría">
                    <Select
                      value={movCategoryId}
                      onChange={(e) => {
                        setMovCategoryId(e.target.value);
                        setMovPage(1);
                      }}
                    >
                      <option value="">Todas</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  <Field label="Buscar">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                      <Input
                        className="pl-9"
                        placeholder="Notas / cuenta / categoría…"
                        value={movQ}
                        onChange={(e) => {
                          setMovQ(e.target.value);
                          setMovPage(1);
                        }}
                      />
                    </div>
                  </Field>
                </div>

                <div className="mt-4 overflow-x-auto rounded-2xl border border-zinc-200">
                  <table className="min-w-full">
                    <thead className="bg-zinc-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Hora</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Tipo</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Cuenta</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Categoría</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">Monto</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Notas</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">Acciones</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-zinc-100">
                      {movLoading || !movs ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-6 text-sm text-zinc-500">
                            Cargando movimientos…
                          </td>
                        </tr>
                      ) : movs.items.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-6 text-sm text-zinc-500">
                            No hay movimientos para este día.
                          </td>
                        </tr>
                      ) : (
                        movs.items.map((r) => {
                          const typeLabel =
                            r.type === "INCOME" ? "Ingreso" : r.type === "EXPENSE" ? "Gasto" : "Transfer";

                          const accName =
                            r.accountNameSnapshot ||
                            (r.accountId ? accountNameById.get(r.accountId) : null) ||
                            r.accountId ||
                            "—";

                          const toAccName = r.toAccountId
                            ? accountNameById.get(r.toAccountId) || r.toAccountId
                            : null;

                          const catName =
                            r.categoryNameSnapshot ||
                            (r.categoryId ? categoryNameById.get(r.categoryId) : null) ||
                            (r.categoryId ? r.categoryId : null) ||
                            (r.type === "TRANSFER" ? "—" : "Sin categoría");

                          return (
                            <tr key={r.id} className="hover:bg-zinc-50/60">
                              <td className="px-4 py-3 text-sm text-zinc-700">{fmtTime(r.createdAt ?? null)}</td>

                              <td className="px-4 py-3 text-sm font-semibold text-zinc-900">{typeLabel}</td>

                              <td className="px-4 py-3 text-sm text-zinc-700">
                                {r.type === "TRANSFER" ? (
                                  <span>
                                    {accName} <span className="text-zinc-400">→</span> {toAccName || "—"}
                                  </span>
                                ) : (
                                  accName
                                )}
                              </td>

                              <td className="px-4 py-3 text-sm text-zinc-700">{catName}</td>

                              <td className="px-4 py-3 text-right text-sm font-bold text-zinc-900">
                                {moneyARS(r.amount)}
                              </td>

                              <td className="px-4 py-3 text-sm text-zinc-700">{r.notes?.trim() ? r.notes : "—"}</td>

                              <td className="px-4 py-3 text-right">
                                <Button
                                  variant="secondary"
                                  disabled={busy || r.status === "VOID"}
                                  onClick={() => voidMovement(r.id)}
                                >
                                  {r.status === "VOID" ? "Anulado" : "Anular"}
                                </Button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {movs && movs.total > movLimit && (
                  <div className="mt-3 flex items-center justify-between">
                    <div className="text-xs text-zinc-500">
                      Página {movs.page} · {movs.total} movimientos
                    </div>
                    <div className="flex gap-2">
                      <Button variant="secondary" disabled={busy || movPage <= 1} onClick={() => setMovPage((p) => Math.max(1, p - 1))}>
                        Anterior
                      </Button>
                      <Button
                        variant="secondary"
                        disabled={busy || movs.page * movs.limit >= movs.total}
                        onClick={() => setMovPage((p) => p + 1)}
                      >
                        Siguiente
                      </Button>
                    </div>
                  </div>
                )}
              </CardBody>
            </Card>

            {/* By account */}
            <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
              <div className="border-b border-zinc-100 px-5 py-4">
                <h2 className="text-lg font-semibold text-zinc-900">Por cuenta</h2>
                <p className="mt-1 text-sm text-zinc-500">Ingresos, gastos, transferencias y saldo inicio/fin.</p>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-zinc-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Cuenta</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">Ingresos</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">Gastos</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">Neto</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">Transf. In</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">Transf. Out</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">Saldo Inicio</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">Saldo Fin</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-zinc-100">
                    {!stats ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-6 text-sm text-zinc-500">
                          Cargando…
                        </td>
                      </tr>
                    ) : byAccountRows.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-6 text-sm text-zinc-500">
                          No hay datos para mostrar.
                        </td>
                      </tr>
                    ) : (
                      byAccountRows.map((r) => {
                        const name = accountNameById.get(r.accountId) ?? r.accountId;
                        return (
                          <tr key={r.accountId} className="hover:bg-zinc-50/60">
                            <td className="px-4 py-3">
                              <div className="text-sm font-semibold text-zinc-900">{name}</div>
                              <div className="text-xs text-zinc-500">{r.accountId}</div>
                            </td>
                            <td className="px-4 py-3 text-right text-sm font-semibold text-zinc-900">{moneyARS(r.income)}</td>
                            <td className="px-4 py-3 text-right text-sm font-semibold text-zinc-900">{moneyARS(r.expense)}</td>
                            <td className={cn("px-4 py-3 text-right text-sm font-bold", r.net >= 0 ? "text-emerald-700" : "text-red-700")}>
                              {moneyARS(r.net)}
                            </td>
                            <td className="px-4 py-3 text-right text-sm text-zinc-700">{moneyARS(r.transferIn)}</td>
                            <td className="px-4 py-3 text-right text-sm text-zinc-700">{moneyARS(r.transferOut)}</td>
                            <td className="px-4 py-3 text-right text-sm text-zinc-700">{moneyARS(r.startBalance)}</td>
                            <td className="px-4 py-3 text-right text-sm font-semibold text-zinc-900">{moneyARS(r.endBalance)}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Categories + series */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
                <div className="border-b border-zinc-100 px-5 py-4">
                  <h2 className="text-lg font-semibold text-zinc-900">Categorías</h2>
                  <p className="mt-1 text-sm text-zinc-500">Totales por categoría (snapshot).</p>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead className="bg-zinc-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Tipo</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Categoría</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">Total</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">Movs</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {!stats ? (
                        <tr>
                          <td colSpan={4} className="px-4 py-6 text-sm text-zinc-500">
                            Cargando…
                          </td>
                        </tr>
                      ) : categoryRows.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-4 py-6 text-sm text-zinc-500">
                            No hay categorías en este día.
                          </td>
                        </tr>
                      ) : (
                        categoryRows.slice(0, 30).map((r, idx) => (
                          <tr key={`${r.type}-${r.categoryId ?? "null"}-${idx}`} className="hover:bg-zinc-50/60">
                            <td className="px-4 py-3 text-sm font-semibold text-zinc-900">
                              {r.type === "EXPENSE" ? "GASTO" : "INGRESO"}
                            </td>
                            <td className="px-4 py-3 text-sm text-zinc-700">
                              {r.nameSnapshot || r.categoryId || "Sin categoría"}
                            </td>
                            <td className="px-4 py-3 text-right text-sm font-semibold text-zinc-900">
                              {moneyARS(r.total)}
                            </td>
                            <td className="px-4 py-3 text-right text-sm text-zinc-700">{r.count}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
                <div className="border-b border-zinc-100 px-5 py-4">
                  <h2 className="text-lg font-semibold text-zinc-900">Evolución (día)</h2>
                  <p className="mt-1 text-sm text-zinc-500">Para "día" normalmente es 1 fila.</p>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead className="bg-zinc-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Día</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">Ingresos</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">Gastos</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">Neto</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {!stats ? (
                        <tr>
                          <td colSpan={4} className="px-4 py-6 text-sm text-zinc-500">
                            Cargando…
                          </td>
                        </tr>
                      ) : stats.seriesDaily.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-4 py-6 text-sm text-zinc-500">
                            No hay datos en este día.
                          </td>
                        </tr>
                      ) : (
                        stats.seriesDaily.map((r) => (
                          <tr key={r.dateKey} className="hover:bg-zinc-50/60">
                            <td className="px-4 py-3 text-sm font-semibold text-zinc-900">{r.dateKey}</td>
                            <td className="px-4 py-3 text-right text-sm text-zinc-700">{moneyARS(r.income)}</td>
                            <td className="px-4 py-3 text-right text-sm text-zinc-700">{moneyARS(r.expense)}</td>
                            <td className={cn("px-4 py-3 text-right text-sm font-bold", r.net >= 0 ? "text-emerald-700" : "text-red-700")}>
                              {moneyARS(r.net)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Quick links */}
            <Card>
              <CardHeader title="Accesos rápidos" subtitle="Carga diaria y gestión" />
              <CardBody>
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={() => (window.location.href = "/cashier/pos")}>
                   POS
                  </Button>
                  <Button variant="secondary" onClick={() => (window.location.href = "/cashier/orders")}>
                    Orders
                  </Button>
                    <Button variant="secondary" onClick={() => (window.location.href = "/cashier/cash")}>
                    Caja
                  </Button>
                  <Button variant="secondary" onClick={() => (window.location.href = "/cashier/closing")}>
                    Cierre del día
                  </Button>
                </div>

                <p className="mt-3 text-xs text-zinc-500">Después agregamos creación inline de movimientos y cierre UI.</p>
              </CardBody>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
