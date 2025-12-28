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
  const router = useRouter();
  const { getAccessToken } = useAuth();

  const [dateKey, setDateKey] = useState(todayKey());
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierId, setSupplierId] = useState("");

  const [products, setProducts] = useState<Product[]>([]);
  const [qtyByProductId, setQtyByProductId] = useState<Record<string, string>>(
    {}
  );

  const [loading, setLoading] = useState(true);
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
      return p.minQty > 0 && Number.isFinite(n) && n < p.minQty;
    }).length;

    const missing = activeProducts.filter(
      (p) => (qtyByProductId[p.id] ?? "") === ""
    ).length;

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
      const isBelowMin = p.minQty > 0 && Number.isFinite(n) && n < p.minQty;
      const isMissing = raw === "";

      if (showOnlyBelowMin && !isBelowMin) return false;
      if (showOnlyMissing && !isMissing) return false;

      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        unitLabel(p.unit).toLowerCase().includes(q)
      );
    });
  }, [activeProducts, qtyByProductId, query, showOnlyBelowMin, showOnlyMissing]);

  // ---------------- Data ----------------

  async function loadSuppliers() {
    setErr(null);
    setLoading(true);
    try {
      const s = await apiFetchAuthed<Supplier[]>(getAccessToken, "/suppliers");
      setSuppliers(s);

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
      initialHashRef.current = JSON.stringify(map);
      hasLoadedOnceRef.current = true;
    } catch (e: any) {
      setErr(e?.message || "Error cargando stock");
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

  const isDirty = useMemo(() => {
    if (!hasLoadedOnceRef.current) return false;
    return JSON.stringify(qtyByProductId) !== initialHashRef.current;
  }, [qtyByProductId]);

  // ---------------- Actions ----------------

  function setQty(productId: string, v: string) {
    if (v === "" || /^[0-9]*([.][0-9]*)?$/.test(v)) {
      setQtyByProductId((prev) => ({ ...prev, [productId]: v }));
    }
  }

  function stepQty(productId: string, step: number) {
    const raw = qtyByProductId[productId] ?? "";
    const current = raw === "" ? 0 : Number(raw);
    const next = clamp(current + step, 0, 999999);
    setQtyByProductId((prev) => ({ ...prev, [productId]: String(next) }));
  }

  async function save() {
    if (!supplierId) return;

    setErr(null);
    setOkMsg(null);
    setSaving(true);

    try {
      const items = activeProducts.map((p) => ({
        productId: p.id,
        qty: Number(qtyByProductId[p.id] ?? 0),
      }));

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

  // ---------------- UI ----------------

  const statusPill = loading ? (
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
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold text-zinc-900">
                    Conteo diario de stock
                  </h1>
                  {statusPill}
                  {isDirty && !loading && (
                    <span className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-700">
                      Cambios sin guardar
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-zinc-500">
                  Snapshot diario por proveedor (histórico).
                </p>
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
                  />
                </Field>

                <Field label="Proveedor">
                  <Select
                    value={supplierId}
                    onChange={(e) => setSupplierId(e.target.value)}
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
                    />
                  </div>
                </Field>

                <div className="flex items-end gap-2">
                  <Button
                    variant={showOnlyBelowMin ? "secondary" : "ghost"}
                    onClick={() => setShowOnlyBelowMin((v) => !v)}
                  >
                    <Flame className="h-4 w-4" />
                    Bajo mínimo
                  </Button>

                  <Button
                    variant={showOnlyMissing ? "secondary" : "ghost"}
                    onClick={() => setShowOnlyMissing((v) => !v)}
                  >
                    Sin cargar
                  </Button>
                </div>

                <div className="flex items-end justify-end">
                  <Button
                    variant={compact ? "secondary" : "ghost"}
                    onClick={() => setCompact((v) => !v)}
                  >
                    {compact ? "Compacto ON" : "Compacto"}
                  </Button>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Tabla */}
          {/* (el resto del render de productos queda IGUAL que el tuyo) */}
        </div>
      </div>
    </Protected>
  );
}
