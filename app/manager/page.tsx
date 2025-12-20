"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AdminProtected } from "@/components/AdminProtected";
import { useAuth } from "@/app/providers/AuthProvider";
import { apiFetchAuthed } from "@/lib/apiAuthed";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { useRouter } from "next/navigation";

// Si tenés lucide-react en el proyecto (lo usás en otras pantallas DMA), suma UX.
// Si no lo tenés, borrá este import y los íconos (no rompe lógica).
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
  dateKey: string; // YYYY-MM-DD
  at: string; // ISO
  employeeName?: string;
  taskName?: string;
  notes?: string | null;
};

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

// ✅ Solo permitimos estas rutas desde este panel
const ALLOWED_MANAGER_ROUTES = new Set([
  "/manager/attendance",
  "/manager/stock",
  "/manager/production",
  "/manager/weekly",
]);

export default function ManagerPanel() {
  const router = useRouter();
  const { getAccessToken, logout } = useAuth();

  const [dateKey, setDateKey] = useState(todayKeyArgentina());
  const [alerts, setAlerts] = useState<StockAlertRow[]>([]);
  const [prod, setProd] = useState<ProductionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  console.log(prod);
  // UX states
  const [query, setQuery] = useState("");
  const [onlyProblems, setOnlyProblems] = useState(true); // default: muestra solo alertas
  const [openProviders, setOpenProviders] = useState<Record<string, boolean>>(
    {}
  );

  function safePush(path: string) {
    if (!ALLOWED_MANAGER_ROUTES.has(path)) return;
    router.push(path);
  }

  async function load() {
    setError(null);
    setLoading(true);
    try {
      const a = await apiFetchAuthed<StockAlertRow[]>(
        getAccessToken,
        `/stock-snapshots/alerts?dateKey=${encodeURIComponent(dateKey)}`
      );
      setAlerts(Array.isArray(a) ? a : []);

      const p = await apiFetchAuthed<ProductionRow[]>(
        getAccessToken,
        `/production?dateKey=${dateKey}&limit=25`
      );
      setProd(Array.isArray(p) ? p : []);
    } catch (e: any) {
      setError(e?.message || "Error cargando panel");
      setAlerts([]);
      setProd([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateKey]);

  const stats = useMemo(() => {
    const low = alerts.filter((x) => x.status === "LOW").length;
    const noc = alerts.filter((x) => x.status === "NO_COUNT").length;
    return {
      low,
      noCount: noc,
      prodCount: prod.length,
      alertsTotal: alerts.length,
    };
  }, [alerts, prod]);

  const filteredAlerts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return alerts.filter((r) => {
      if (onlyProblems && r.status !== "LOW" && r.status !== "NO_COUNT")
        return false;

      if (!q) return true;
      const hay = `${r.name} ${r.providerName || ""} ${r.providerId || ""} ${
        r.unit || ""
      }`
        .toLowerCase()
        .includes(q);
      return hay;
    });
  }, [alerts, query, onlyProblems]);

  const groupedByProvider = useMemo(() => {
    const map = new Map<string, StockAlertRow[]>();
    for (const r of filteredAlerts) {
      const key = r.providerName || r.providerId || "Sin proveedor";
      const arr = map.get(key) || [];
      arr.push(r);
      map.set(key, arr);
    }

    // sort: primero proveedores con LOW, luego NO_COUNT, luego alfabético
    const entries = [...map.entries()].map(([provider, rows]) => {
      const low = rows.filter((x) => x.status === "LOW").length;
      const noc = rows.filter((x) => x.status === "NO_COUNT").length;
      return { provider, rows, low, noc };
    });

    entries.sort((a, b) => {
      const ap = a.low > 0 ? 0 : a.noc > 0 ? 1 : 2;
      const bp = b.low > 0 ? 0 : b.noc > 0 ? 1 : 2;
      if (ap !== bp) return ap - bp;
      return a.provider.localeCompare(b.provider);
    });

    return entries;
  }, [filteredAlerts]);

  // Inicializa colapsables: abiertos por defecto los que tienen problemas.
  useEffect(() => {
    if (loading) return;
    setOpenProviders((prev) => {
      const next = { ...prev };
      for (const g of groupedByProvider) {
        if (next[g.provider] === undefined) {
          next[g.provider] = true; // default abierto
        }
      }
      return next;
    });
  }, [loading, groupedByProvider]);

  const topBarDateLabel = useMemo(() => {
    // muestra “hoy” si coincide con fecha actual local
    const today = todayKeyArgentina();
    if (dateKey === today) return "Hoy";
    return dateKey;
  }, [dateKey]);

  const overallOk = !loading && stats.low === 0 && stats.noCount === 0;

  return (
    <AdminProtected allow={["ADMIN", "MANAGER"]}>
      <div className="min-h-screen bg-zinc-50">
        {/* Header sticky */}
        <div className="sticky top-0 z-10 border-b border-zinc-200 bg-white/80 backdrop-blur">
          <div className="mx-auto max-w-6xl px-4 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold text-zinc-900">
                    Panel Manager
                  </h1>
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold",
                      overallOk
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : "bg-amber-50 text-amber-800 border border-amber-200"
                    )}
                    title="Estado general"
                  >
                    {loading ? (
                      "Cargando…"
                    ) : overallOk ? (
                      <>
                        <CheckCircle2 className="mr-1 h-4 w-4" />
                        OK
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="mr-1 h-4 w-4" />
                        Atención
                      </>
                    )}
                  </span>

                  <span className="ml-1 inline-flex items-center gap-1 text-xs text-zinc-500">
                    <CalendarDays className="h-4 w-4" />
                    {topBarDateLabel}
                  </span>
                </div>
                <p className="mt-1 text-sm text-zinc-500">
                  Operación diaria: stock + producción. Navegación restringida a
                  módulos manager.
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
                    try {
                      await load();
                    } finally {
                      setBusy(false);
                    }
                  }}
                  loading={busy}
                  disabled={busy}
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

            {error && (
              <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}
          </div>
        </div>

        <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
          {/* Quick actions + Cards */}
          <div className="grid gap-4 lg:grid-cols-3">
            {/* Stock card */}
            <Card>
              <CardHeader
                title="Stock"
                subtitle="Alertas de mínimo y faltantes de conteo"
              />
              <CardBody>
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <div className="text-3xl font-bold text-zinc-900">
                      {loading ? "—" : stats.low}
                    </div>
                    <p className="mt-1 text-sm text-zinc-600">
                      Bajo mínimo
                      <span className="mx-2 text-zinc-300">•</span>
                      Sin conteo:{" "}
                      <b className="text-zinc-900">
                        {loading ? "—" : stats.noCount}
                      </b>
                    </p>
                  </div>

                  <div
                    className={cn(
                      "rounded-2xl border px-3 py-2 text-xs font-semibold",
                      loading
                        ? "border-zinc-200 text-zinc-500"
                        : stats.low > 0
                        ? "border-red-200 bg-red-50 text-red-700"
                        : stats.noCount > 0
                        ? "border-amber-200 bg-amber-50 text-amber-800"
                        : "border-emerald-200 bg-emerald-50 text-emerald-700"
                    )}
                  >
                    {loading
                      ? "—"
                      : stats.low > 0
                      ? "Prioridad: reponer"
                      : stats.noCount > 0
                      ? "Prioridad: contar"
                      : "Todo OK"}
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => safePush("/manager/stock")}
                  >
                    <span className="inline-flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      Ir a Stock
                    </span>
                  </Button>
                </div>
              </CardBody>
            </Card>

            {/* Production card */}
            <Card>
              <CardHeader
                title="Producción"
                subtitle="Últimos registros del día"
              />
              <CardBody>
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <div className="text-3xl font-bold text-zinc-900">
                      {loading ? "—" : stats.prodCount}
                    </div>
                    <p className="mt-1 text-sm text-zinc-600">
                      Registros cargados
                    </p>
                  </div>

                  <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-semibold text-zinc-700">
                    {loading
                      ? "—"
                      : stats.prodCount === 0
                      ? "Sin actividad"
                      : "En marcha"}
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => safePush("/manager/production")}
                  >
                    <span className="inline-flex items-center gap-2">
                      <Factory className="h-4 w-4" />
                      Ir a Producción
                    </span>
                  </Button>
                </div>
              </CardBody>
            </Card>

            {/* Actions card */}
            <Card>
              <CardHeader
                title="Acciones rápidas"
                subtitle="Solo módulos manager"
              />
              <CardBody>
                <div className="grid gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => safePush("/manager/weekly")}
                  >
                    <span className="inline-flex items-center gap-2">
                      <ClipboardList className="h-4 w-4" />
                      Weekly
                    </span>
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => safePush("/manager/attendance")}
                  >
                    <span className="inline-flex items-center gap-2">
                      <ClipboardList className="h-4 w-4" />
                      Asistencia
                    </span>
                  </Button>

                  <Button
                    variant="secondary"
                    onClick={() => safePush("/manager/stock")}
                  >
                    <span className="inline-flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      Stock
                    </span>
                  </Button>

                  <Button
                    variant="secondary"
                    onClick={() => safePush("/manager/production")}
                  >
                    <span className="inline-flex items-center gap-2">
                      <Factory className="h-4 w-4" />
                      Producción
                    </span>
                  </Button>
                </div>
              </CardBody>
            </Card>
          </div>

          {/* Alerts */}
          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <div className="border-b border-zinc-100 px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-zinc-900">
                    Alertas de Stock
                  </h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    Rojo = bajo mínimo. Amarillo = sin conteo hoy. Agrupado por
                    proveedor.
                  </p>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap items-end gap-2">
                  <div className="min-w-[240px]">
                    <Field label="Buscar">
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                        <Input
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                          placeholder="Producto / proveedor / unidad…"
                          className="pl-9"
                        />
                      </div>
                    </Field>
                  </div>

                  <Button
                    variant={onlyProblems ? "secondary" : "ghost"}
                    onClick={() => setOnlyProblems((v) => !v)}
                  >
                    {onlyProblems ? "Solo problemas" : "Mostrar todo"}
                  </Button>
                </div>
              </div>
            </div>

            <div className="p-5 space-y-4">
              {loading ? (
                <div className="space-y-3">
                  <div className="h-10 w-full rounded-xl bg-zinc-100 animate-pulse" />
                  <div className="h-24 w-full rounded-xl bg-zinc-100 animate-pulse" />
                  <div className="h-24 w-full rounded-xl bg-zinc-100 animate-pulse" />
                </div>
              ) : groupedByProvider.length === 0 ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-5 w-5" />
                    <div>
                      <div className="font-semibold">
                        No hay alertas para esta fecha 🎉
                      </div>
                      <div className="mt-1 text-emerald-700">
                        Tip: si esperabas items, probá desactivar “Solo
                        problemas” o revisá que se haya hecho el conteo.
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                groupedByProvider.map((g) => {
                  const isOpen = openProviders[g.provider] ?? true;
                  return (
                    <div
                      key={g.provider}
                      className="rounded-2xl border border-zinc-200 overflow-hidden"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setOpenProviders((p) => ({
                            ...p,
                            [g.provider]: !isOpen,
                          }))
                        }
                        className="w-full px-4 py-3 bg-zinc-50 border-b border-zinc-200 flex items-center justify-between gap-3 text-left"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <div className="text-sm font-semibold text-zinc-900">
                              {g.provider}
                            </div>

                            {g.low > 0 && (
                              <span className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">
                                {g.low} bajo mínimo
                              </span>
                            )}
                            {g.noc > 0 && (
                              <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800">
                                {g.noc} sin conteo
                              </span>
                            )}
                            {g.low === 0 && g.noc === 0 && (
                              <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                                OK
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-zinc-500 mt-0.5">
                            {g.rows.length} items
                          </div>
                        </div>

                        <div className="text-zinc-500">
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
                                  Producto
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                                  Cantidad
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                                  Mínimo
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                                  Estado
                                </th>
                              </tr>
                            </thead>

                            <tbody className="divide-y divide-zinc-100">
                              {g.rows.map((r) => {
                                const isLow = r.status === "LOW";
                                const isNo = r.status === "NO_COUNT";

                                const qtyText =
                                  r.qty === null ? "Sin conteo" : r.qty;
                                const minText = r.minQty ?? "—";

                                return (
                                  <tr
                                    key={r.productId}
                                    className={cn(
                                      "hover:bg-zinc-50/60",
                                      isLow && "bg-red-50",
                                      isNo && "bg-amber-50"
                                    )}
                                  >
                                    <td className="px-4 py-3">
                                      <div className="text-sm font-semibold text-zinc-900">
                                        {r.name}
                                      </div>
                                      {r.unit ? (
                                        <div className="text-xs text-zinc-500">
                                          Unidad: {r.unit}
                                        </div>
                                      ) : null}
                                    </td>

                                    <td className="px-4 py-3 text-sm text-zinc-700">
                                      {qtyText}
                                    </td>

                                    <td className="px-4 py-3 text-sm text-zinc-700">
                                      {minText}
                                    </td>

                                    <td className="px-4 py-3">
                                      {isLow ? (
                                        <span className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">
                                          Bajo mínimo
                                        </span>
                                      ) : isNo ? (
                                        <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800">
                                          Sin conteo
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                                          OK
                                        </span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div className="border-t border-zinc-100 px-5 py-4 flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm text-zinc-600">
                Total alertas:{" "}
                <b className="text-zinc-900">
                  {loading ? "—" : filteredAlerts.length}
                </b>
                <span className="mx-2 text-zinc-300">•</span>
                Bajo mínimo:{" "}
                <b className="text-zinc-900">{loading ? "—" : stats.low}</b>
                <span className="mx-2 text-zinc-300">•</span>
                Sin conteo:{" "}
                <b className="text-zinc-900">{loading ? "—" : stats.noCount}</b>
              </div>

              <Button
                variant="secondary"
                onClick={() => safePush("/manager/stock")}
              >
                Ir a Stock
              </Button>
            </div>
          </div>

          {/* Production */}
          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <div className="border-b border-zinc-100 px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-zinc-900">
                    Producción (hoy)
                  </h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    Últimos registros del día.
                  </p>
                </div>

                <Button
                  variant="secondary"
                  onClick={() => safePush("/manager/production")}
                >
                  Ver módulo
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-zinc-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Hora
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Empleado
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
                  {loading ? (
                    [...Array(6)].map((_, i) => (
                      <tr key={i}>
                        <td className="px-4 py-4">
                          <div className="h-4 w-24 bg-zinc-100 rounded animate-pulse" />
                        </td>
                        <td className="px-4 py-4">
                          <div className="h-4 w-40 bg-zinc-100 rounded animate-pulse" />
                        </td>
                        <td className="px-4 py-4">
                          <div className="h-4 w-44 bg-zinc-100 rounded animate-pulse" />
                        </td>
                        <td className="px-4 py-4">
                          <div className="h-4 w-64 bg-zinc-100 rounded animate-pulse" />
                        </td>
                      </tr>
                    ))
                  ) : prod.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-4 py-6 text-sm text-zinc-600"
                      >
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-600" />
                          <div>
                            <div className="font-semibold text-zinc-900">
                              No hay producción cargada hoy.
                            </div>
                            <div className="mt-1 text-zinc-600">
                              Revisá el módulo de Producción para cargar o ver
                              tareas.
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    prod.slice(0, 25).map((r) => (
                      <tr key={r.id} className="hover:bg-zinc-50/60">
                        <td className="px-4 py-3 text-sm text-zinc-700">
                          {fmtShort(r.at)}
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-zinc-900">
                          {r.employeeName || "—"}
                        </td>
                        <td className="px-4 py-3 text-sm text-zinc-700">
                          {r.taskName || "—"}
                        </td>
                        <td className="px-4 py-3 text-sm text-zinc-700">
                          {r.notes?.trim() ? r.notes : "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="border-t border-zinc-100 px-5 py-4 flex justify-end">
              <Button onClick={() => safePush("/manager/production")}>
                Ir a Producción
              </Button>
            </div>
          </div>
        </div>
      </div>
    </AdminProtected>
  );
}
