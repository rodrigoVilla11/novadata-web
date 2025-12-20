"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Protected } from "@/components/Protected";
import { useAuth } from "@/app/providers/AuthProvider";
import { apiFetchAuthed } from "@/lib/apiAuthed";
import { todayKey } from "@/lib/dateKey";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Field";

// (Opcional) Si ya usás lucide-react en tu proyecto, suma mucho.
import {
  RefreshCcw,
  Search,
  AlertTriangle,
  CheckCircle2,
  ChevronUp,
  ChevronDown,
  Flame,
} from "lucide-react";

type Supplier = { id: string; name: string; isActive: boolean };
type Product = {
  id: string;
  name: string;
  unit: "UNIT" | "KG" | "L";
  supplierId: string;
  isActive: boolean;
  minQty: number;
};

type Snapshot = {
  id: string;
  dateKey: string;
  supplierId: string;
  items: { productId: string; qty: number }[];
};

function unitLabel(u: Product["unit"]) {
  if (u === "UNIT") return "Unidad";
  if (u === "KG") return "Kg";
  if (u === "L") return "Litros";
  return u;
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default function StockPage() {
  const { getAccessToken } = useAuth();

  const [dateKey, setDateKey] = useState(todayKey());
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierId, setSupplierId] = useState<string>("");

  const [products, setProducts] = useState<Product[]>([]);
  const [qtyByProductId, setQtyByProductId] = useState<Record<string, string>>(
    {}
  );

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyRefresh, setBusyRefresh] = useState(false);

  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  // UX add-ons
  const [query, setQuery] = useState("");
  const [showOnlyBelowMin, setShowOnlyBelowMin] = useState(false);
  const [showOnlyMissing, setShowOnlyMissing] = useState(false);
  const [compact, setCompact] = useState(false);

  // Warn on unsaved changes
  const initialHashRef = useRef<string>("");
  const hasLoadedOnceRef = useRef(false);

  const activeSuppliers = useMemo(
    () => suppliers.filter((s) => s.isActive !== false),
    [suppliers]
  );

  const activeProducts = useMemo(
    () => products.filter((p) => p.isActive !== false),
    [products]
  );

  const stats = useMemo(() => {
    const belowMin = activeProducts.filter((p) => {
      const raw = qtyByProductId[p.id] ?? "";
      const n = raw === "" ? 0 : Number(raw);
      const min = Number(p.minQty ?? 0);
      return min > 0 && Number.isFinite(n) && n < min;
    }).length;

    const missing = activeProducts.filter((p) => {
      const raw = qtyByProductId[p.id] ?? "";
      return raw === ""; // sin cargar
    }).length;

    return {
      total: activeProducts.length,
      belowMin,
      missing,
      ok: activeProducts.length > 0 && belowMin === 0 && missing === 0,
    };
  }, [activeProducts, qtyByProductId]);

  const filteredProducts = useMemo(() => {
    const q = query.trim().toLowerCase();

    return activeProducts.filter((p) => {
      const raw = qtyByProductId[p.id] ?? "";
      const n = raw === "" ? 0 : Number(raw);
      const min = Number(p.minQty ?? 0);
      const isBelowMin = min > 0 && Number.isFinite(n) && n < min;
      const isMissing = raw === "";

      if (showOnlyBelowMin && !isBelowMin) return false;
      if (showOnlyMissing && !isMissing) return false;

      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        unitLabel(p.unit).toLowerCase().includes(q) ||
        String(p.minQty ?? "").includes(q)
      );
    });
  }, [
    activeProducts,
    qtyByProductId,
    query,
    showOnlyBelowMin,
    showOnlyMissing,
  ]);

  // ---- Data loading ----

  async function loadSuppliers() {
    setErr(null);
    setLoading(true);
    try {
      const s = await apiFetchAuthed<Supplier[]>(getAccessToken, "/suppliers");
      setSuppliers(s);

      // auto-select el primero
      const first =
        s.find((x) => x.isActive !== false && x.id === supplierId) ||
        s.find((x) => x.isActive !== false);
      if (first) setSupplierId(first.id);
    } catch (e: any) {
      setErr(e?.message || "Error cargando proveedores");
    } finally {
      setLoading(false);
    }
  }

  async function loadSupplierData(nextSupplierId?: string) {
    const sid = nextSupplierId ?? supplierId;
    if (!sid) return;

    setErr(null);
    setOkMsg(null);
    setLoading(true);

    try {
      const prods = await apiFetchAuthed<Product[]>(
        getAccessToken,
        `/products?supplierId=${encodeURIComponent(sid)}`
      );
      setProducts(prods);

      const snap = await apiFetchAuthed<Snapshot | null>(
        getAccessToken,
        `/stock-snapshots?dateKey=${encodeURIComponent(
          dateKey
        )}&supplierId=${encodeURIComponent(sid)}`
      );

      const map: Record<string, string> = {};
      for (const p of prods) map[p.id] = "";
      if (snap?.items?.length) {
        for (const it of snap.items) map[it.productId] = String(it.qty ?? "");
      }
      setQtyByProductId(map);

      // set unsaved-hash baseline
      initialHashRef.current = JSON.stringify(map);
      hasLoadedOnceRef.current = true;
    } catch (e: any) {
      setErr(e?.message || "Error cargando productos o conteo");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSuppliers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!supplierId) return;
    loadSupplierData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supplierId, dateKey]);

  // Warn before leaving if there are unsaved changes
  const isDirty = useMemo(() => {
    if (!hasLoadedOnceRef.current) return false;
    const now = JSON.stringify(qtyByProductId);
    return now !== initialHashRef.current;
  }, [qtyByProductId]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!isDirty) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  // ---- Input behavior ----

  function setQty(productId: string, v: string) {
    // permitimos "", "12", "12.5"
    if (v === "" || /^[0-9]*([.][0-9]*)?$/.test(v)) {
      setQtyByProductId((prev) => ({ ...prev, [productId]: v }));
    }
  }

  function stepQty(productId: string, step: number) {
    const raw = qtyByProductId[productId] ?? "";
    const current = raw === "" ? 0 : Number(raw);
    const next = clamp((Number.isFinite(current) ? current : 0) + step, 0, 999999);
    setQtyByProductId((prev) => ({ ...prev, [productId]: String(next) }));
  }

  async function save() {
    if (!supplierId) return;

    setErr(null);
    setOkMsg(null);
    setSaving(true);

    try {
      const items = activeProducts
        .map((p) => {
          const raw = qtyByProductId[p.id];
          const qty = raw === "" ? 0 : Number(raw);
          return { productId: p.id, qty };
        })
        .filter((it) => Number.isFinite(it.qty));

      await apiFetchAuthed(getAccessToken, "/stock-snapshots", {
        method: "PUT",
        body: JSON.stringify({ dateKey, supplierId, items }),
      });

      setOkMsg("Guardado ✔");
      initialHashRef.current = JSON.stringify(qtyByProductId);
    } catch (e: any) {
      setErr(e?.message || "Error guardando");
    } finally {
      setSaving(false);
    }
  }

  async function refresh() {
    setBusyRefresh(true);
    try {
      await loadSupplierData();
    } finally {
      setBusyRefresh(false);
    }
  }

  // ---- UI helpers ----

  const statusPill = useMemo(() => {
    if (loading) {
      return (
        <span className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-semibold text-zinc-600">
          Cargando…
        </span>
      );
    }

    if (stats.total === 0) {
      return (
        <span className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-semibold text-zinc-600">
          Sin productos
        </span>
      );
    }

    if (stats.ok) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
          <CheckCircle2 className="h-4 w-4" />
          Todo OK
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">
        <AlertTriangle className="h-4 w-4" />
        Atención
      </span>
    );
  }, [loading, stats]);

  return (
    <Protected>
      <div className="min-h-screen bg-zinc-50">
        {/* Sticky header */}
        <div className="sticky top-0 z-10 border-b border-zinc-200 bg-white/80 backdrop-blur">
          <div className="mx-auto max-w-6xl px-4 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold text-zinc-900">
                    Conteo diario de stock
                  </h1>
                  {statusPill}
                  {isDirty && !loading && (
                    <span className="inline-flex items-center rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-700">
                      Cambios sin guardar
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-zinc-500">
                  Guardás un snapshot por día y proveedor (histórico).
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="secondary"
                  onClick={refresh}
                  loading={busyRefresh}
                  disabled={busyRefresh || saving || !supplierId}
                >
                  <span className="inline-flex items-center gap-2">
                    <RefreshCcw className="h-4 w-4" />
                    Refrescar
                  </span>
                </Button>

                <Button
                  onClick={save}
                  loading={saving}
                  disabled={saving || loading || !supplierId}
                >
                  Guardar
                </Button>
              </div>
            </div>

            {/* Mini resumen */}
            {!loading && supplierId && (
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                <span className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-zinc-700">
                  Total: <b className="text-zinc-900">{stats.total}</b>
                </span>

                <span
                  className={cn(
                    "rounded-full border px-2.5 py-1",
                    stats.belowMin > 0
                      ? "border-red-200 bg-red-50 text-red-700"
                      : "border-emerald-200 bg-emerald-50 text-emerald-700"
                  )}
                >
                  Bajo mínimo: <b>{stats.belowMin}</b>
                </span>

                <span
                  className={cn(
                    "rounded-full border px-2.5 py-1",
                    stats.missing > 0
                      ? "border-amber-200 bg-amber-50 text-amber-800"
                      : "border-emerald-200 bg-emerald-50 text-emerald-700"
                  )}
                >
                  Sin cargar: <b>{stats.missing}</b>
                </span>
              </div>
            )}

            {err && (
              <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {err}
              </div>
            )}
            {okMsg && (
              <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                {okMsg}
              </div>
            )}
          </div>
        </div>

        <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
          {/* Filters card */}
          <Card>
            <CardHeader title="Filtros" subtitle="Elegí fecha y proveedor" />
            <CardBody>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Fecha">
                  <Input
                    type="date"
                    value={dateKey}
                    onChange={(e) => setDateKey(e.target.value)}
                  />
                </Field>

                <Field label="Proveedor">
                  <Select
                    value={supplierId}
                    onChange={async (e) => {
                      const next = e.target.value;
                      setSupplierId(next);
                      // carga inmediata con el nuevo supplier (mejor UX)
                      await loadSupplierData(next);
                    }}
                  >
                    {activeSuppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>

              {/* Search + toggles */}
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <Field label="Buscar producto">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                    <Input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Nombre, unidad, mínimo…"
                      className="pl-9"
                    />
                  </div>
                </Field>

                <div className="flex items-end gap-2">
                  <Button
                    variant={showOnlyBelowMin ? "secondary" : "ghost"}
                    onClick={() => setShowOnlyBelowMin((v) => !v)}
                    disabled={loading}
                  >
                    {showOnlyBelowMin ? (
                      <span className="inline-flex items-center gap-2">
                        <Flame className="h-4 w-4" />
                        Solo bajo mínimo
                      </span>
                    ) : (
                      "Ver bajo mínimo"
                    )}
                  </Button>

                  <Button
                    variant={showOnlyMissing ? "secondary" : "ghost"}
                    onClick={() => setShowOnlyMissing((v) => !v)}
                    disabled={loading}
                  >
                    {showOnlyMissing ? "Solo sin cargar" : "Ver sin cargar"}
                  </Button>
                </div>

                <div className="flex items-end justify-end">
                  <Button
                    variant={compact ? "secondary" : "ghost"}
                    onClick={() => setCompact((v) => !v)}
                    disabled={loading}
                  >
                    {compact ? "Compacto: ON" : "Compacto"}
                  </Button>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Products */}
          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <div className="border-b border-zinc-100 px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-zinc-900">
                    Productos
                  </h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    Anotá la cantidad actual. Se marca en rojo si está por debajo
                    del mínimo.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    onClick={save}
                    loading={saving}
                    disabled={saving || loading || !supplierId}
                  >
                    Guardar
                  </Button>
                </div>
              </div>
            </div>

            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-zinc-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Producto
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Unidad
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Mínimo
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Cantidad
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Acciones
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-zinc-100">
                  {loading && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-sm text-zinc-500">
                        Cargando…
                      </td>
                    </tr>
                  )}

                  {!loading && filteredProducts.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-sm text-zinc-500">
                        No hay productos que coincidan con los filtros.
                      </td>
                    </tr>
                  )}

                  {!loading &&
                    filteredProducts.map((p) => {
                      const raw = qtyByProductId[p.id] ?? "";
                      const n = raw === "" ? 0 : Number(raw);
                      const min = Number(p.minQty ?? 0);
                      const isBelowMin = min > 0 && Number.isFinite(n) && n < min;
                      const isMissing = raw === "";

                      return (
                        <tr
                          key={p.id}
                          className={cn(
                            "hover:bg-zinc-50/60",
                            isBelowMin && "bg-red-50"
                          )}
                        >
                          <td className={cn("px-4", compact ? "py-2" : "py-3")}>
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="text-sm font-semibold text-zinc-900 truncate">
                                  {p.name}
                                </div>

                                <div className="mt-1 flex flex-wrap items-center gap-2">
                                  {isBelowMin ? (
                                    <span className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">
                                      Bajo mínimo
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-xs font-semibold text-zinc-700">
                                      OK
                                    </span>
                                  )}

                                  {isMissing && (
                                    <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800">
                                      Sin cargar
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className={cn("px-4", compact ? "py-2" : "py-3")}>
                            <span className="rounded-full border border-zinc-200 bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-700">
                              {unitLabel(p.unit)}
                            </span>
                          </td>

                          <td className={cn("px-4", compact ? "py-2" : "py-3")}>
                            <span
                              className={cn(
                                "text-sm font-semibold",
                                min > 0 ? "text-zinc-900" : "text-zinc-500"
                              )}
                            >
                              {min > 0 ? min : "—"}
                            </span>
                          </td>

                          <td className={cn("px-4", compact ? "py-2" : "py-3")}>
                            <input
                              className={cn(
                                "w-36 rounded-xl border px-3 py-2 text-sm outline-none focus:ring-4",
                                isBelowMin
                                  ? "border-red-300 bg-red-50 text-red-900 focus:border-red-400 focus:ring-red-100"
                                  : "border-zinc-200 bg-white text-zinc-900 focus:border-zinc-400 focus:ring-zinc-100"
                              )}
                              value={raw}
                              onChange={(e) => setQty(p.id, e.target.value)}
                              placeholder="0"
                              inputMode="decimal"
                            />
                          </td>

                          <td className={cn("px-4", compact ? "py-2" : "py-3")}>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="secondary"
                                onClick={() => stepQty(p.id, -1)}
                                disabled={loading || saving}
                              >
                                -1
                              </Button>
                              <Button
                                variant="secondary"
                                onClick={() => stepQty(p.id, +1)}
                                disabled={loading || saving}
                              >
                                +1
                              </Button>

                              {min > 0 && (
                                <Button
                                  variant="secondary"
                                  onClick={() =>
                                    setQtyByProductId((prev) => ({
                                      ...prev,
                                      [p.id]: String(min),
                                    }))
                                  }
                                  disabled={loading || saving}
                                  title="Setear al mínimo"
                                >
                                  Min
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden p-4 space-y-3">
              {loading ? (
                <div className="text-sm text-zinc-500">Cargando…</div>
              ) : filteredProducts.length === 0 ? (
                <div className="text-sm text-zinc-500">
                  No hay productos que coincidan con los filtros.
                </div>
              ) : (
                filteredProducts.map((p) => {
                  const raw = qtyByProductId[p.id] ?? "";
                  const n = raw === "" ? 0 : Number(raw);
                  const min = Number(p.minQty ?? 0);
                  const isBelowMin = min > 0 && Number.isFinite(n) && n < min;
                  const isMissing = raw === "";

                  return (
                    <div
                      key={p.id}
                      className={cn(
                        "rounded-2xl border p-4",
                        isBelowMin
                          ? "border-red-200 bg-red-50"
                          : "border-zinc-200 bg-white"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-zinc-900 truncate">
                            {p.name}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <span className="rounded-full border border-zinc-200 bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-700">
                              {unitLabel(p.unit)}
                            </span>
                            {min > 0 && (
                              <span
                                className={cn(
                                  "rounded-full border px-2.5 py-1 text-xs font-semibold",
                                  isBelowMin
                                    ? "border-red-200 bg-red-50 text-red-700"
                                    : "border-zinc-200 bg-white text-zinc-700"
                                )}
                              >
                                Mín: {min}
                              </span>
                            )}
                            {isMissing && (
                              <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">
                                Sin cargar
                              </span>
                            )}
                          </div>
                        </div>

                        {isBelowMin ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">
                            <AlertTriangle className="h-4 w-4" />
                            Bajo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                            <CheckCircle2 className="h-4 w-4" />
                            OK
                          </span>
                        )}
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <input
                          className={cn(
                            "w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-4",
                            isBelowMin
                              ? "border-red-300 bg-red-50 text-red-900 focus:border-red-400 focus:ring-red-100"
                              : "border-zinc-200 bg-white text-zinc-900 focus:border-zinc-400 focus:ring-zinc-100"
                          )}
                          value={raw}
                          onChange={(e) => setQty(p.id, e.target.value)}
                          placeholder="0"
                          inputMode="decimal"
                        />

                        <div className="flex gap-2">
                          <Button
                            variant="secondary"
                            onClick={() => stepQty(p.id, -1)}
                            disabled={loading || saving}
                          >
                            -1
                          </Button>
                          <Button
                            variant="secondary"
                            onClick={() => stepQty(p.id, +1)}
                            disabled={loading || saving}
                          >
                            +1
                          </Button>
                        </div>

                        {min > 0 && (
                          <Button
                            variant="secondary"
                            onClick={() =>
                              setQtyByProductId((prev) => ({
                                ...prev,
                                [p.id]: String(min),
                              }))
                            }
                            disabled={loading || saving}
                          >
                            Setear a mínimo
                          </Button>
                        )}

                        <Button
                          onClick={save}
                          loading={saving}
                          disabled={saving || loading || !supplierId}
                        >
                          Guardar
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="border-t border-zinc-100 px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-zinc-500">
                  Tip: podés guardar varias veces el mismo día (upsert).
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      // Expand UX: rellena 0 a los vacíos
                      setQtyByProductId((prev) => {
                        const next = { ...prev };
                        for (const p of activeProducts) {
                          if ((next[p.id] ?? "") === "") next[p.id] = "0";
                        }
                        return next;
                      });
                    }}
                    disabled={loading || saving}
                  >
                    Completar vacíos en 0
                  </Button>

                  <Button
                    onClick={save}
                    loading={saving}
                    disabled={saving || loading || !supplierId}
                  >
                    Guardar
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Tiny helpers for keyboard-driven usage */}
          <div className="text-xs text-zinc-500">
            Atajos: buscá con el campo de búsqueda • usá -1/+1 para ajustar rápido
            • “Cambios sin guardar” te avisa antes de salir.
          </div>
        </div>
      </div>
    </Protected>
  );
}
