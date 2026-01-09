"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { AdminProtected } from "@/components/AdminProtected";
import { useAuth } from "@/app/providers/AuthProvider";
import { apiFetchAuthed } from "@/lib/apiAuthed";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { useRouter } from "next/navigation";

import {
  RefreshCcw,
  AlertTriangle,
  ClipboardList,
  Package,
  Factory,
  CheckCircle2,
  Search,
  ChevronDown,
  ChevronUp,
  CalendarDays,
} from "lucide-react";

/* ================= Utils ================= */

function todayKeyArgentina() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Cordoba",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function fmtShort(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-AR", {
    timeZone: "America/Argentina/Cordoba",
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  });
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function num(n: any, fallback = 0) {
  const v = typeof n === "number" ? n : Number(n);
  return Number.isFinite(v) ? v : fallback;
}

/* ================= Types ================= */

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

type ProductionRow = {
  id: string;
  dateKey: string;
  at: string;
  employeeName?: string;
  taskName?: string;
  notes?: string | null;
};

/* ================= Routing ================= */

const ALLOWED_MANAGER_ROUTES = new Set([
  "/manager/attendance",
  "/manager/stock",
  "/manager/production",
  "/manager/weekly",
]);

/* ================= Page ================= */

export default function ManagerPanel() {
  const router = useRouter();
  const auth = useAuth();

  // ✅ depende de tu AuthProvider: dejé tolerante
  const getAccessToken = auth?.getAccessToken;
  const branchId: string | null =
    (auth as any)?.user?.branchId ??
    (auth as any)?.userData?.branchId ??
    (auth as any)?.branchId ??
    null;

  const [dateKey, setDateKey] = useState(todayKeyArgentina());
  const [alerts, setAlerts] = useState<StockAlertRow[]>([]);
  const [prod, setProd] = useState<ProductionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [onlyProblems, setOnlyProblems] = useState(true);
  const [openProviders, setOpenProviders] = useState<Record<string, boolean>>(
    {}
  );

  const reqSeq = useRef(0);

  function safePush(path: string) {
    if (!ALLOWED_MANAGER_ROUTES.has(path)) return;
    router.push(path);
  }

  function buildQS(params: Record<string, any>) {
    const p = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v === undefined || v === null || `${v}`.trim() === "") return;
      p.set(k, String(v));
    });
    return p.toString();
  }

  async function load() {
    if (!getAccessToken) return;

    const seq = ++reqSeq.current;

    setError(null);
    setLoading(true);

    try {
      const qsAlerts = buildQS({ dateKey, branchId });
      const qsProd = buildQS({ dateKey, limit: 25, branchId });

      // ✅ paralelo y consistente
      const [a, p] = await Promise.all([
        apiFetchAuthed<StockAlertRow[]>(
          getAccessToken,
          `/stock/alerts?dateKey=${dateKey}`
        ),
        apiFetchAuthed<ProductionRow[]>(
          getAccessToken,
          `/production?${qsProd}`
        ),
      ]);

      // ✅ si hubo una request más nueva, ignorar
      if (seq !== reqSeq.current) return;

      setAlerts(Array.isArray(a) ? a : []);
      setProd(Array.isArray(p) ? p : []);
    } catch (e: any) {
      if (seq !== reqSeq.current) return;
      setError(e?.message || "Error cargando panel");
      setAlerts([]);
      setProd([]);
    } finally {
      if (seq !== reqSeq.current) return;
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateKey, branchId]);

  const stats = useMemo(() => {
    const low = alerts.filter((x) => x.status === "LOW").length;
    const noCount = alerts.filter((x) => x.status === "NO_COUNT").length;
    return { low, noCount, prodCount: prod.length };
  }, [alerts, prod]);

  const overallOk = !loading && stats.low === 0 && stats.noCount === 0;

  const filteredAlerts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return alerts.filter((r) => {
      if (onlyProblems && r.status !== "LOW" && r.status !== "NO_COUNT")
        return false;
      if (!q) return true;
      return `${r.name} ${r.providerName || ""}`.toLowerCase().includes(q);
    });
  }, [alerts, query, onlyProblems]);

  const groupedByProvider = useMemo(() => {
    const map = new Map<string, StockAlertRow[]>();
    for (const r of filteredAlerts) {
      const key = r.providerName || r.providerId || "Sin proveedor";
      map.set(key, [...(map.get(key) || []), r]);
    }
    return [...map.entries()]
      .map(([provider, rows]) => ({
        provider,
        rows: rows.slice().sort((a, b) => (a.name || "").localeCompare(b.name)),
        low: rows.filter((x) => x.status === "LOW").length,
        noc: rows.filter((x) => x.status === "NO_COUNT").length,
      }))
      .sort((a, b) => b.low + b.noc - (a.low + a.noc));
  }, [filteredAlerts]);

  useEffect(() => {
    // ✅ inicializa providers nuevos como abiertos, conserva lo existente
    setOpenProviders((prev) => {
      const next = { ...prev };
      groupedByProvider.forEach((g) => {
        if (next[g.provider] === undefined) next[g.provider] = true;
      });
      return next;
    });
  }, [groupedByProvider]);

  const recentProd = useMemo(() => {
    return prod
      .slice()
      .sort((a, b) => (b.at || "").localeCompare(a.at || ""))
      .slice(0, 8);
  }, [prod]);

  return (
    <AdminProtected allow={["ADMIN", "MANAGER"]}>
      <div className="space-y-6 md:space-y-8">
        {/* Header */}
        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-zinc-900">
                  Panel Manager
                </h1>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-semibold border",
                    overallOk
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-red-50 text-red-700 border-red-200"
                  )}
                >
                  {loading
                    ? "Cargando..."
                    : overallOk
                    ? "Todo OK"
                    : "Requiere atención"}
                </span>
              </div>

              <p className="mt-1 text-sm text-zinc-500">
                Operación diaria: stock, producción y control.
                {branchId ? (
                  <span className="ml-2 text-xs text-zinc-400">
                    • Sucursal: <b className="text-zinc-600">{branchId}</b>
                  </span>
                ) : null}
              </p>
            </div>

            <div className="flex items-end gap-2">
              <Field label="Fecha">
                <Input
                  type="date"
                  value={dateKey}
                  onChange={(e) => setDateKey(e.target.value)}
                />
              </Field>

              <Button
                variant="secondary"
                onClick={async () => {
                  setBusy(true);
                  await load();
                  setBusy(false);
                }}
                loading={busy}
                title="Recargar"
              >
                <RefreshCcw className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {error && (
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        {/* Cards */}
        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader title="Stock" subtitle="Alertas activas" />
            <CardBody>
              <div className="text-3xl font-bold">{stats.low}</div>
              <p className="text-sm text-zinc-600">
                Bajo mínimo • Sin conteo: <b>{stats.noCount}</b>
              </p>
              <Button
                className="mt-4"
                onClick={() => safePush("/manager/stock")}
              >
                <Package className="h-4 w-4" />
                Ir a Stock
              </Button>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Producción" subtitle="Registros del día" />
            <CardBody>
              <div className="text-3xl font-bold">{stats.prodCount}</div>
              <p className="text-sm text-zinc-600">Tareas registradas</p>
              <Button
                className="mt-4"
                onClick={() => safePush("/manager/production")}
              >
                <Factory className="h-4 w-4" />
                Ir a Producción
              </Button>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Acciones rápidas" />
            <CardBody>
              <Button onClick={() => safePush("/manager/stock")}>
                <Package className="h-4 w-4" />
                Stock
              </Button>
              <Button onClick={() => safePush("/manager/production")}>
                <Factory className="h-4 w-4" />
                Producción
              </Button>
              <Button
                variant="secondary"
                onClick={() => safePush("/manager/attendance")}
              >
                <ClipboardList className="h-4 w-4" />
                Asistencia
              </Button>
              <Button
                variant="secondary"
                onClick={() => safePush("/manager/weekly")}
              >
                Weekly
              </Button>
            </CardBody>
          </Card>
        </div>

        {/* Content grid */}
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Alerts */}
          <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-zinc-700" />
                  <h2 className="text-lg font-semibold text-zinc-900">
                    Alertas de Stock
                  </h2>
                </div>
                <p className="mt-1 text-sm text-zinc-500">
                  Agrupadas por proveedor • Fecha {dateKey}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Buscar producto / proveedor..."
                    className={cn(
                      "h-10 w-[260px] rounded-2xl border border-zinc-200 bg-white pl-10 pr-3 text-sm",
                      "focus:outline-none focus:ring-4 focus:ring-emerald-100"
                    )}
                  />
                </div>

                <Button
                  variant={onlyProblems ? "secondary" : "ghost"}
                  onClick={() => setOnlyProblems((s) => !s)}
                  title="Toggle"
                >
                  {onlyProblems ? "Solo problemas" : "Mostrar todo"}
                </Button>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between gap-2">
              <div className="text-sm text-zinc-600">
                <span className="font-semibold">{filteredAlerts.length}</span>{" "}
                items •{" "}
                <span className="text-red-700 font-semibold">{stats.low}</span>{" "}
                bajo mínimo •{" "}
                <span className="text-amber-700 font-semibold">
                  {stats.noCount}
                </span>{" "}
                sin conteo
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  onClick={() =>
                    setOpenProviders((prev) => {
                      const next: Record<string, boolean> = { ...prev };
                      groupedByProvider.forEach(
                        (g) => (next[g.provider] = true)
                      );
                      return next;
                    })
                  }
                >
                  <ChevronDown className="h-4 w-4" /> Abrir todo
                </Button>
                <Button
                  variant="ghost"
                  onClick={() =>
                    setOpenProviders((prev) => {
                      const next: Record<string, boolean> = { ...prev };
                      groupedByProvider.forEach(
                        (g) => (next[g.provider] = false)
                      );
                      return next;
                    })
                  }
                >
                  <ChevronUp className="h-4 w-4" /> Cerrar todo
                </Button>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {loading ? (
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">
                  Cargando alertas...
                </div>
              ) : groupedByProvider.length === 0 ? (
                <div
                  className={cn(
                    "rounded-2xl border p-4 text-sm",
                    overallOk
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                      : "border-zinc-200 bg-zinc-50 text-zinc-700"
                  )}
                >
                  {overallOk ? (
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4" />
                      No hay alertas para esta fecha.
                    </div>
                  ) : (
                    "Sin resultados con estos filtros."
                  )}
                </div>
              ) : (
                groupedByProvider.map((g) => {
                  const isOpen = !!openProviders[g.provider];
                  return (
                    <div
                      key={g.provider}
                      className="rounded-2xl border border-zinc-200 overflow-hidden"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setOpenProviders((prev) => ({
                            ...prev,
                            [g.provider]: !prev[g.provider],
                          }))
                        }
                        className={cn(
                          "w-full px-4 py-3 bg-white hover:bg-zinc-50 transition flex items-center justify-between gap-3"
                        )}
                      >
                        <div className="min-w-0 text-left">
                          <div className="truncate font-semibold text-zinc-900">
                            {g.provider}
                          </div>
                          <div className="text-xs text-zinc-500">
                            {g.rows.length} items •{" "}
                            <span className="text-red-700 font-semibold">
                              {g.low} low
                            </span>{" "}
                            •{" "}
                            <span className="text-amber-700 font-semibold">
                              {g.noc} no-count
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-xs font-semibold border",
                              g.low > 0 || g.noc > 0
                                ? "bg-red-50 text-red-700 border-red-200"
                                : "bg-emerald-50 text-emerald-700 border-emerald-200"
                            )}
                          >
                            {g.low + g.noc}
                          </span>
                          {isOpen ? (
                            <ChevronUp className="h-4 w-4 text-zinc-500" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-zinc-500" />
                          )}
                        </div>
                      </button>

                      {isOpen ? (
                        <div className="bg-white">
                          <div className="divide-y divide-zinc-100">
                            {g.rows.map((r) => {
                              const isLow = r.status === "LOW";
                              const isNo = r.status === "NO_COUNT";
                              const qty = num(r.qty, 0);
                              const min = num(r.minQty, 0);

                              return (
                                <div
                                  key={`${g.provider}-${r.productId}`}
                                  className="px-4 py-3 flex items-center justify-between gap-4"
                                >
                                  <div className="min-w-0">
                                    <div className="truncate font-medium text-zinc-900">
                                      {r.name}
                                    </div>
                                    <div className="mt-0.5 text-xs text-zinc-500">
                                      {isNo ? (
                                        <span className="text-amber-700 font-semibold">
                                          Sin conteo cargado
                                        </span>
                                      ) : (
                                        <span>
                                          Actual:{" "}
                                          <b className="text-zinc-700">
                                            {qty}
                                            {r.unit ? ` ${r.unit}` : ""}
                                          </b>{" "}
                                          • Mínimo:{" "}
                                          <b className="text-zinc-700">
                                            {min}
                                            {r.unit ? ` ${r.unit}` : ""}
                                          </b>
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  <span
                                    className={cn(
                                      "shrink-0 rounded-full px-2 py-1 text-xs font-semibold border",
                                      isLow
                                        ? "bg-red-50 text-red-700 border-red-200"
                                        : isNo
                                        ? "bg-amber-50 text-amber-800 border-amber-200"
                                        : "bg-zinc-50 text-zinc-700 border-zinc-200"
                                    )}
                                  >
                                    {isLow
                                      ? "Bajo mínimo"
                                      : isNo
                                      ? "Sin conteo"
                                      : "OK"}
                                  </span>
                                </div>
                              );
                            })}
                          </div>

                          <div className="px-4 py-3 bg-zinc-50 flex items-center justify-end gap-2">
                            <Button
                              variant="secondary"
                              onClick={() => safePush("/manager/stock")}
                            >
                              <Package className="h-4 w-4" />
                              Ver en Stock
                            </Button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Production */}
          <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-5 w-5 text-zinc-700" />
                  <h2 className="text-lg font-semibold text-zinc-900">
                    Producción del día
                  </h2>
                </div>
                <p className="mt-1 text-sm text-zinc-500">
                  Últimos registros • Fecha {dateKey}
                </p>
              </div>

              <Button onClick={() => safePush("/manager/production")}>
                <Factory className="h-4 w-4" />
                Abrir Producción
              </Button>
            </div>

            <div className="mt-4">
              {loading ? (
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">
                  Cargando producción...
                </div>
              ) : recentProd.length === 0 ? (
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
                  No hay registros de producción para esta fecha.
                </div>
              ) : (
                <div className="space-y-3">
                  {recentProd.map((r) => (
                    <div
                      key={r.id}
                      className="rounded-2xl border border-zinc-200 bg-white p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-zinc-900">
                            {r.taskName || "Tarea"}
                          </div>
                          <div className="mt-0.5 text-sm text-zinc-600">
                            {r.employeeName ? (
                              <span className="font-medium">
                                {r.employeeName}
                              </span>
                            ) : (
                              <span className="text-zinc-400">
                                Sin empleado
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="shrink-0 text-right">
                          <div className="text-xs text-zinc-500">Hora</div>
                          <div className="text-sm font-semibold text-zinc-900">
                            {fmtShort(r.at)}
                          </div>
                        </div>
                      </div>

                      {r.notes ? (
                        <div className="mt-3 text-sm text-zinc-600">
                          <span className="text-zinc-500">Notas: </span>
                          {r.notes}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => safePush("/manager/attendance")}
              >
                <ClipboardList className="h-4 w-4" />
                Ir a Asistencia
              </Button>
              <Button
                variant="secondary"
                onClick={() => safePush("/manager/weekly")}
              >
                Weekly
              </Button>
            </div>
          </div>
        </div>
      </div>
    </AdminProtected>
  );
}
