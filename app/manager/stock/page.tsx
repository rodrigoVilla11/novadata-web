"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Protected } from "@/components/Protected";
import { useAuth } from "@/app/providers/AuthProvider";
import { apiFetchAuthed } from "@/lib/apiAuthed";
import { todayKey } from "@/lib/dateKey";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Field";
import {
  RefreshCcw,
  Search,
  AlertTriangle,
  CheckCircle2,
  Flame,
  ArrowLeft,
  Minus,
  Plus,
  XCircle,
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

function toNum(raw: string | undefined) {
  if (raw == null || raw === "") return 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function looksForbidden(msg: string) {
  const m = (msg || "").toLowerCase();
  return m.includes("forbidden") || m.includes("sin permisos") || m.includes("prohibido");
}

export default function StockPage() {
  const router = useRouter();
  const { getAccessToken } = useAuth();

  // Form
  const [dateKey, setDateKey] = useState(todayKey());
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierId, setSupplierId] = useState("");

  const [products, setProducts] = useState<Product[]>([]);
  const [qtyByProductId, setQtyByProductId] = useState<Record<string, string>>({});

  // States
  const [loadingSuppliers, setLoadingSuppliers] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyRefresh, setBusyRefresh] = useState(false);

  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  // UX
  const [query, setQuery] = useState("");
  const [showOnlyBelowMin, setShowOnlyBelowMin] = useState(false);
  const [showOnlyMissing, setShowOnlyMissing] = useState(false);
  const [compact, setCompact] = useState(false);

  // Dirty tracking
  const initialHashRef = useRef("");
  const hasLoadedOnceRef = useRef(false);

  // Prevent setState after unmount
  const aliveRef = useRef(true);
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

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
      const n = toNum(qtyByProductId[p.id]);
      return p.minQty > 0 && n < p.minQty;
    }).length;

    const missing = activeProducts.filter((p) => (qtyByProductId[p.id] ?? "") === "").length;

    return {
      total: activeProducts.length,
      belowMin,
      missing,
      ok: activeProducts.length > 0 && belowMin === 0 && missing === 0,
    };
  }, [activeProducts, qtyByProductId]);

  const filteredProducts = useMemo(() => {
    const q = query.trim().toLowerCase();

    return activeProducts
      .filter((p) => {
        const raw = qtyByProductId[p.id] ?? "";
        const n = raw === "" ? 0 : Number(raw);
        const isBelowMin = p.minQty > 0 && Number.isFinite(n) && n < p.minQty;
        const isMissing = raw === "";

        if (showOnlyBelowMin && !isBelowMin) return false;
        if (showOnlyMissing && !isMissing) return false;

        if (!q) return true;
        return (
          p.name.toLowerCase().includes(q) ||
          unitLabel(p.unit).toLowerCase().includes(q)
        );
      })
      // UX: primero faltantes, luego bajo mínimo, luego alfabético
      .sort((a, b) => {
        const aMissing = (qtyByProductId[a.id] ?? "") === "" ? 1 : 0;
        const bMissing = (qtyByProductId[b.id] ?? "") === "" ? 1 : 0;
        if (bMissing !== aMissing) return bMissing - aMissing;

        const aBelow = a.minQty > 0 && toNum(qtyByProductId[a.id]) < a.minQty ? 1 : 0;
        const bBelow = b.minQty > 0 && toNum(qtyByProductId[b.id]) < b.minQty ? 1 : 0;
        if (bBelow !== aBelow) return bBelow - aBelow;

        return a.name.localeCompare(b.name);
      });
  }, [activeProducts, qtyByProductId, query, showOnlyBelowMin, showOnlyMissing]);

  // ---------------- Data ----------------

  async function loadSuppliers() {
    setErr(null);
    setOkMsg(null);
    setLoadingSuppliers(true);

    try {
      // Espera a que exista token (evita el primer render sin auth)
      let token = await getAccessToken();
      if (!token) {
        // reintento corto, pero sin loop infinito si se desmonta
        await new Promise((r) => setTimeout(r, 150));
        token = await getAccessToken();
      }
      if (!token) throw new Error("No autenticado (token no disponible).");

      const s = await apiFetchAuthed<Supplier[]>(async () => token!, "/suppliers");

      if (!aliveRef.current) return;
      setSuppliers(s);

      const first =
        s.find((x) => x.isActive !== false && x.id === supplierId) ||
        s.find((x) => x.isActive !== false);

      if (first && aliveRef.current) setSupplierId(first.id);
    } catch (e: any) {
      const msg = String(e?.message || "Error cargando proveedores");
      if (looksForbidden(msg)) {
        setErr("Sin permisos para ver proveedores (tu rol no está habilitado para Stock).");
      } else {
        setErr(msg);
      }
    } finally {
      if (aliveRef.current) setLoadingSuppliers(false);
    }
  }

  async function loadSupplierData(nextSupplierId?: string) {
    const sid = nextSupplierId ?? supplierId;
    if (!sid) return;

    setErr(null);
    setOkMsg(null);
    setLoadingData(true);

    try {
      const prods = await apiFetchAuthed<Product[]>(
        getAccessToken,
        `/products?supplierId=${encodeURIComponent(sid)}`
      );
      if (!aliveRef.current) return;
      setProducts(prods);

      const snap = await apiFetchAuthed<Snapshot | null>(
        getAccessToken,
        `/stock-snapshots?dateKey=${encodeURIComponent(dateKey)}&supplierId=${encodeURIComponent(sid)}`
      );

      if (!aliveRef.current) return;

      const map: Record<string, string> = {};
      for (const p of prods) map[p.id] = "";
      if (snap?.items?.length) {
        for (const it of snap.items) map[it.productId] = String(it.qty ?? "");
      }

      setQtyByProductId(map);
      initialHashRef.current = JSON.stringify(map);
      hasLoadedOnceRef.current = true;
    } catch (e: any) {
      const msg = String(e?.message || "Error cargando stock");
      if (looksForbidden(msg)) {
        setErr("Sin permisos para ver stock / snapshots.");
      } else {
        setErr(msg);
      }
    } finally {
      if (aliveRef.current) setLoadingData(false);
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

  const isDirty = useMemo(() => {
    if (!hasLoadedOnceRef.current) return false;
    return JSON.stringify(qtyByProductId) !== initialHashRef.current;
  }, [qtyByProductId]);

  const isLoading = loadingSuppliers || loadingData;

  // ---------------- Actions ----------------

  function setQty(productId: string, v: string) {
    // acepta "" o números con punto
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

  function clearAll() {
    if (!window.confirm("¿Vaciar todos los valores cargados?")) return;
    const next: Record<string, string> = {};
    for (const p of products) next[p.id] = "";
    setQtyByProductId(next);
  }

  async function save() {
    if (!supplierId) return;

    setErr(null);
    setOkMsg(null);
    setSaving(true);

    try {
      const items = activeProducts.map((p) => ({
        productId: p.id,
        qty: toNum(qtyByProductId[p.id]),
      }));

      await apiFetchAuthed(getAccessToken, "/stock-snapshots", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dateKey, supplierId, items }),
      });

      if (!aliveRef.current) return;
      setOkMsg("Guardado ✔");
      initialHashRef.current = JSON.stringify(qtyByProductId);
    } catch (e: any) {
      const msg = String(e?.message || "Error guardando");
      if (looksForbidden(msg)) {
        setErr("Sin permisos para guardar snapshots.");
      } else {
        setErr(msg);
      }
    } finally {
      if (aliveRef.current) setSaving(false);
    }
  }

  async function refresh() {
    setBusyRefresh(true);
    try {
      await loadSupplierData();
    } finally {
      if (aliveRef.current) setBusyRefresh(false);
    }
  }

  // ---------------- UI ----------------

  const statusPill = isLoading ? (
    <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-semibold text-zinc-600">
      Cargando…
    </span>
  ) : stats.ok ? (
    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
      <CheckCircle2 className="h-4 w-4" />
      Todo OK
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">
      <AlertTriangle className="h-4 w-4" />
      Atención
    </span>
  );

  return (
    <Protected>
      <div className="space-y-6">
        {/* Sticky header */}
        <div className="sticky top-0 z-10 border-b border-zinc-200 bg-white/80 backdrop-blur">
          <div className="px-4 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-bold text-zinc-900">Conteo diario de stock</h1>
                  {statusPill}
                  {isDirty && !isLoading && (
                    <span className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-700">
                      Cambios sin guardar
                    </span>
                  )}
                </div>

                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-zinc-500">
                  <span>Snapshot diario por proveedor (histórico).</span>
                  {!isLoading && (
                    <span className="text-zinc-600">
                      Total: <b>{stats.total}</b> · Bajo mínimo:{" "}
                      <b className={stats.belowMin ? "text-amber-700" : ""}>{stats.belowMin}</b> · Sin cargar:{" "}
                      <b className={stats.missing ? "text-amber-700" : ""}>{stats.missing}</b>
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button variant="secondary" onClick={() => router.back()}>
                  <ArrowLeft className="h-4 w-4" />
                  Volver
                </Button>

                <Button
                  variant="secondary"
                  onClick={refresh}
                  loading={busyRefresh}
                  disabled={busyRefresh || saving || !supplierId}
                >
                  <RefreshCcw className="h-4 w-4" />
                  Actualizar
                </Button>

                <Button
                  variant="secondary"
                  onClick={clearAll}
                  disabled={saving || isLoading || products.length === 0}
                >
                  <XCircle className="h-4 w-4" />
                  Vaciar
                </Button>

                <Button onClick={save} loading={saving} disabled={saving || isLoading || !supplierId}>
                  Guardar
                </Button>
              </div>
            </div>

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

        {/* Content */}
        <div className="space-y-6">
          {/* Filtros */}
          <Card>
            <CardHeader title="Filtros" subtitle="Fecha y proveedor" />
            <CardBody>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Fecha">
                  <Input
                    type="date"
                    value={dateKey}
                    onChange={(e) => setDateKey(e.target.value)}
                    disabled={saving}
                  />
                </Field>

                <Field label="Proveedor">
                  <Select
                    value={supplierId}
                    onChange={(e) => setSupplierId(e.target.value)}
                    disabled={loadingSuppliers || saving}
                  >
                    {activeSuppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <Field label="Buscar producto">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                    <Input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Nombre, unidad…"
                      className="pl-9"
                      disabled={isLoading}
                    />
                  </div>
                </Field>

                <div className="flex items-end gap-2">
                  <Button
                    variant={showOnlyBelowMin ? "secondary" : "ghost"}
                    onClick={() => setShowOnlyBelowMin((v) => !v)}
                    disabled={isLoading}
                  >
                    <Flame className="h-4 w-4" />
                    Bajo mínimo
                  </Button>

                  <Button
                    variant={showOnlyMissing ? "secondary" : "ghost"}
                    onClick={() => setShowOnlyMissing((v) => !v)}
                    disabled={isLoading}
                  >
                    Sin cargar
                  </Button>
                </div>

                <div className="flex items-end justify-end">
                  <Button
                    variant={compact ? "secondary" : "ghost"}
                    onClick={() => setCompact((v) => !v)}
                    disabled={isLoading}
                  >
                    {compact ? "Compacto ON" : "Compacto"}
                  </Button>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Tabla */}
          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <div className="border-b border-zinc-100 px-5 py-4">
              <h2 className="text-lg font-semibold text-zinc-900">Productos</h2>
              <p className="mt-1 text-sm text-zinc-500">
                Tip: podés usar <b>+</b>/<b>-</b> para ajustar rápido. Si el stock está bajo mínimo se marca en ámbar.
              </p>
            </div>

            <div className="overflow-x-auto">
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
                  {isLoading && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-sm text-zinc-500">
                        Cargando productos…
                      </td>
                    </tr>
                  )}

                  {!isLoading && filteredProducts.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-sm text-zinc-500">
                        No hay productos para mostrar.
                      </td>
                    </tr>
                  )}

                  {!isLoading &&
                    filteredProducts.map((p, idx) => {
                      const raw = qtyByProductId[p.id] ?? "";
                      const n = toNum(raw);
                      const isMissing = raw === "";
                      const isBelowMin = p.minQty > 0 && n < p.minQty;

                      return (
                        <tr
                          key={p.id}
                          className={cn(
                            "transition",
                            compact ? "text-sm" : "text-base",
                            isBelowMin ? "bg-amber-50/60" : "hover:bg-zinc-50"
                          )}
                        >
                          <td className={cn("px-4", compact ? "py-2" : "py-3")}>
                            <div className="font-semibold text-zinc-900">{p.name}</div>
                            {isMissing && (
                              <div className="mt-0.5 text-xs text-amber-700">Sin cargar</div>
                            )}
                            {isBelowMin && !isMissing && (
                              <div className="mt-0.5 text-xs text-amber-700">
                                Bajo mínimo ({p.minQty})
                              </div>
                            )}
                          </td>

                          <td className={cn("px-4 text-zinc-700", compact ? "py-2" : "py-3")}>
                            {unitLabel(p.unit)}
                          </td>

                          <td className={cn("px-4 text-zinc-700", compact ? "py-2" : "py-3")}>
                            {p.minQty ?? 0}
                          </td>

                          <td className={cn("px-4", compact ? "py-2" : "py-3")}>
                            <Input
                              value={raw}
                              onChange={(e) => setQty(p.id, e.target.value)}
                              placeholder="0"
                              inputMode="decimal"
                              className={cn(
                                "w-32",
                                isBelowMin ? "border-amber-300 focus:ring-amber-200" : ""
                              )}
                              disabled={saving}
                              onKeyDown={(e) => {
                                if (e.key === "+") {
                                  e.preventDefault();
                                  stepQty(p.id, 1);
                                }
                                if (e.key === "-") {
                                  e.preventDefault();
                                  stepQty(p.id, -1);
                                }
                                if (e.key === "Enter") {
                                  // focus al próximo input
                                  const nextId = filteredProducts[idx + 1]?.id;
                                  if (nextId) {
                                    const el = document.querySelector<HTMLInputElement>(
                                      `input[data-stock="${nextId}"]`
                                    );
                                    el?.focus();
                                  }
                                }
                              }}
                              data-stock={p.id}
                            />
                          </td>

                          <td className={cn("px-4", compact ? "py-2" : "py-3")}>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                disabled={saving}
                                onClick={() => stepQty(p.id, -1)}
                                title="-1"
                              >
                                <Minus className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                disabled={saving}
                                onClick={() => stepQty(p.id, +1)}
                                title="+1"
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                disabled={saving}
                                onClick={() => setQty(p.id, "")}
                                title="Vaciar"
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>

            <div className="border-t border-zinc-100 px-5 py-4 text-xs text-zinc-500">
              Mostrando <b>{filteredProducts.length}</b> de <b>{activeProducts.length}</b> productos.
            </div>
          </div>
        </div>
      </div>
    </Protected>
  );
}
