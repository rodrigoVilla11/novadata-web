"use client";

import React, { useEffect, useMemo, useState } from "react";
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
  const { getAccessToken } = useAuth();

  const [dateKey, setDateKey] = useState(todayKeyArgentina());
  const [alerts, setAlerts] = useState<StockAlertRow[]>([]);
  const [prod, setProd] = useState<ProductionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [onlyProblems, setOnlyProblems] = useState(true);
  const [openProviders, setOpenProviders] = useState<Record<string, boolean>>({});

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
        `/stock-snapshots/alerts?dateKey=${dateKey}`
      );
      const p = await apiFetchAuthed<ProductionRow[]>(
        getAccessToken,
        `/production?dateKey=${dateKey}&limit=25`
      );

      setAlerts(Array.isArray(a) ? a : []);
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
  }, [dateKey]);

  const stats = useMemo(() => {
    return {
      low: alerts.filter((x) => x.status === "LOW").length,
      noCount: alerts.filter((x) => x.status === "NO_COUNT").length,
      prodCount: prod.length,
    };
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
    return [...map.entries()].map(([provider, rows]) => ({
      provider,
      rows,
      low: rows.filter((x) => x.status === "LOW").length,
      noc: rows.filter((x) => x.status === "NO_COUNT").length,
    }));
  }, [filteredAlerts]);

  useEffect(() => {
    setOpenProviders((prev) => {
      const next = { ...prev };
      groupedByProvider.forEach((g) => {
        if (next[g.provider] === undefined) next[g.provider] = true;
      });
      return next;
    });
  }, [groupedByProvider]);

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
                  {overallOk ? "Todo OK" : "Requiere atención"}
                </span>
              </div>
              <p className="mt-1 text-sm text-zinc-500">
                Operación diaria: stock, producción y control.
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
      </div>
    </AdminProtected>
  );
}
