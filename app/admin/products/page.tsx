"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AdminProtected } from "@/components/AdminProtected";
import { useAuth } from "@/app/providers/AuthProvider";
import { apiFetchAuthed } from "@/lib/apiAuthed";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Field";
import {
  RefreshCcw,
  Search,
  Plus,
  Filter,
  Package,
  Ruler,
  Power,
  Save,
  CheckCircle2,
  AlertTriangle,
  Truck,
} from "lucide-react";

type Supplier = { id: string; name: string; isActive: boolean };

type Unit = "UNIT" | "KG" | "L";

type Product = {
  id: string;
  name: string;
  unit: Unit;
  supplierId: string;
  isActive: boolean;
  minQty: number;
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function unitLabel(u: Unit) {
  if (u === "UNIT") return "Unidad";
  if (u === "KG") return "Kg";
  if (u === "L") return "Litros";
  return u;
}

function isValidNumberDraft(v: string) {
  // "", "12", "12.5"
  return v === "" || /^[0-9]*([.][0-9]*)?$/.test(v);
}

function StatusPill({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold border",
        active
          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
          : "bg-zinc-100 text-zinc-600 border-zinc-200"
      )}
    >
      {active ? "ACTIVO" : "INACTIVO"}
    </span>
  );
}

export default function AdminProductsPage() {
  const { getAccessToken } = useAuth();

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierId, setSupplierId] = useState("");

  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  // Crear (colapsable)
  const [createOpen, setCreateOpen] = useState(true);
  const [name, setName] = useState("");
  const [unit, setUnit] = useState<Unit>("UNIT");
  const [minQtyCreate, setMinQtyCreate] = useState<string>("0");

  // Buscar + filtros
  const [q, setQ] = useState("");
  const [onlyActive, setOnlyActive] = useState(false);

  // Edit min
  const [minDraft, setMinDraft] = useState<Record<string, string>>({});
  const [savingMinById, setSavingMinById] = useState<Record<string, boolean>>(
    {}
  );

  const searchRef = useRef<HTMLInputElement | null>(null);

  const activeSuppliers = useMemo(
    () => suppliers.filter((s) => s.isActive !== false),
    [suppliers]
  );

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    let base = items;
    if (onlyActive) base = base.filter((p) => p.isActive);
    if (!qq) return base;
    return base.filter((p) => p.name.toLowerCase().includes(qq));
  }, [items, q, onlyActive]);

  const totals = useMemo(() => {
    const total = items.length;
    const active = items.filter((p) => p.isActive).length;
    const inactive = total - active;
    return { total, active, inactive };
  }, [items]);

  const currentSupplierName = useMemo(() => {
    return suppliers.find((s) => s.id === supplierId)?.name ?? "—";
  }, [suppliers, supplierId]);

  async function loadSuppliers(nextSupplierId?: string) {
    const s = await apiFetchAuthed<Supplier[]>(getAccessToken, "/suppliers");
    setSuppliers(s);

    // Autoselect 1er proveedor activo si no hay
    if (!nextSupplierId) {
      const first = s.find((x) => x.isActive !== false);
      if (first) setSupplierId(first.id);
    }
  }

  async function loadProducts(sId: string) {
    const data = await apiFetchAuthed<Product[]>(
      getAccessToken,
      `/products?supplierId=${encodeURIComponent(sId)}`
    );
    setItems(data);

    // Inicializar drafts de mínimo sin pisar ediciones en curso
    setMinDraft((prev) => {
      const next = { ...prev };
      for (const p of data) {
        if (next[p.id] === undefined) next[p.id] = String(p.minQty ?? 0);
      }
      return next;
    });
  }

  async function loadAll() {
    setErr(null);
    setOk(null);
    setLoading(true);
    try {
      await loadSuppliers(supplierId);
      if (supplierId) await loadProducts(supplierId);
      setOk("Datos actualizados ✔");
      window.setTimeout(() => setOk(null), 1600);
    } catch (e: any) {
      setErr(e?.message || "Error cargando");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        // primero proveedores (esto puede setear supplierId)
        await loadSuppliers("");
      } catch (e: any) {
        setErr(e?.message || "Error cargando proveedores");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!supplierId) return;
    (async () => {
      setErr(null);
      setOk(null);
      setLoading(true);
      try {
        await loadProducts(supplierId);
      } catch (e: any) {
        setErr(e?.message || "Error cargando productos");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supplierId]);

  async function create() {
    if (!name.trim() || !supplierId) return;

    if (!isValidNumberDraft(minQtyCreate)) {
      setErr("El mínimo debe ser un número válido (>= 0)");
      return;
    }

    const minQty = minQtyCreate === "" ? 0 : Number(minQtyCreate);
    if (!Number.isFinite(minQty) || minQty < 0) {
      setErr("El mínimo debe ser un número >= 0");
      return;
    }

    setErr(null);
    setOk(null);
    setBusy(true);
    try {
      await apiFetchAuthed(getAccessToken, "/products", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          unit,
          supplierId,
          minQty,
        }),
      });

      setName("");
      setUnit("UNIT");
      setMinQtyCreate("0");
      setOk("Producto creado ✔");
      window.setTimeout(() => setOk(null), 1600);

      await loadProducts(supplierId);
    } catch (e: any) {
      setErr(e?.message || "Error creando producto");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(p: Product) {
    const next = !p.isActive;
    const msg = next
      ? `¿Reactivar "${p.name}"?`
      : `¿Desactivar "${p.name}"?\n\nNo aparecerá para conteo.`;
    if (!window.confirm(msg)) return;

    setErr(null);
    setOk(null);
    setBusy(true);
    try {
      await apiFetchAuthed(getAccessToken, `/products/${p.id}/active`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: next }),
      });
      setOk(next ? "Producto reactivado ✔" : "Producto desactivado ✔");
      window.setTimeout(() => setOk(null), 1600);
      await loadProducts(supplierId);
    } catch (e: any) {
      setErr(e?.message || "Error actualizando producto");
    } finally {
      setBusy(false);
    }
  }

  function setMinValue(productId: string, v: string) {
    if (isValidNumberDraft(v)) {
      setMinDraft((prev) => ({ ...prev, [productId]: v }));
    }
  }

  async function saveMin(p: Product) {
    const raw = minDraft[p.id] ?? String(p.minQty ?? 0);
    const minQty = raw === "" ? 0 : Number(raw);

    if (!Number.isFinite(minQty) || minQty < 0) {
      setErr("El mínimo debe ser un número >= 0");
      return;
    }

    setErr(null);
    setOk(null);
    setSavingMinById((prev) => ({ ...prev, [p.id]: true }));

    try {
      await apiFetchAuthed(getAccessToken, `/products/${p.id}/min`, {
        method: "PATCH",
        body: JSON.stringify({ minQty }),
      });

      setOk(`Mínimo actualizado: ${p.name}`);
      window.setTimeout(() => setOk(null), 1600);
      await loadProducts(supplierId);
    } catch (e: any) {
      setErr(e?.message || "Error actualizando mínimo");
    } finally {
      setSavingMinById((prev) => ({ ...prev, [p.id]: false }));
    }
  }

  function belowMin(p: Product) {
    const raw = minDraft[p.id] ?? String(p.minQty ?? 0);
    const n = raw === "" ? 0 : Number(raw);
    const min = Number(p.minQty ?? 0);
    return min > 0 && Number.isFinite(n) && n < min;
  }

  return (
    <AdminProtected>
      <div className="min-h-screen bg-zinc-50">
        <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
          {/* Sticky header */}
          <div className="sticky top-0 z-10 -mx-4 border-b border-zinc-200 bg-white/80 px-4 py-4 backdrop-blur">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold text-zinc-900">
                  Admin • Productos
                </h1>
                <p className="mt-1 text-sm text-zinc-500">
                  Productos por proveedor + unidad + mínimo.
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-semibold text-zinc-700">
                    Proveedor: {currentSupplierName}
                  </span>
                  <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-semibold text-zinc-700">
                    Total: {totals.total}
                  </span>
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                    Activos: {totals.active}
                  </span>
                  <span className="rounded-full border border-zinc-200 bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-700">
                    Inactivos: {totals.inactive}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  onClick={loadAll}
                  loading={loading}
                  disabled={busy}
                >
                  <span className="inline-flex items-center gap-2">
                    <RefreshCcw className="h-4 w-4" />
                    Refrescar
                  </span>
                </Button>

                <button
                  type="button"
                  title="Buscar"
                  onClick={() => searchRef.current?.focus()}
                  disabled={loading}
                  className="inline-flex h-10 items-center justify-center rounded-xl border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-60"
                >
                  <Search className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Filtros */}
            <div className="mt-4 grid gap-2 sm:grid-cols-[280px_1fr_auto] sm:items-center">
              <div className="relative">
                <Truck className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <Select
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  className="pl-9"
                >
                  {activeSuppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Buscar producto…"
                  className="pl-9"
                />
              </div>

              <button
                type="button"
                onClick={() => setOnlyActive((v) => !v)}
                className={cn(
                  "h-10 rounded-xl border px-3 text-sm font-semibold transition inline-flex items-center gap-2",
                  onlyActive
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50"
                )}
              >
                <Filter className="h-4 w-4" />
                {onlyActive ? "Solo activos" : "Todos"}
              </button>
            </div>

            {(err || ok) && (
              <div className="mt-3 grid gap-2">
                {err && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    <span className="inline-flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      {err}
                    </span>
                  </div>
                )}
                {ok && !err && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                    <span className="inline-flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4" />
                      {ok}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Crear (colapsable) */}
          <Card>
            <div className="flex items-start justify-between gap-4 px-5 pt-5">
              <div>
                <div className="text-base font-semibold text-zinc-900">
                  Crear producto
                </div>
                <div className="mt-1 text-sm text-zinc-500">
                  Se crea dentro del proveedor seleccionado.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCreateOpen((v) => !v)}
                className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
              >
                {createOpen ? "Ocultar" : "Mostrar"}
              </button>
            </div>

            {createOpen && (
              <CardBody>
                <div className="grid gap-4 md:grid-cols-5">
                  <Field label="Nombre">
                    <div className="relative">
                      <Package className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                      <Input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Ej: Arroz para sushi"
                        className="pl-9"
                      />
                    </div>
                  </Field>

                  <Field label="Unidad">
                    <Select
                      value={unit}
                      onChange={(e) => setUnit(e.target.value as Unit)}
                    >
                      <option value="UNIT">Unidad</option>
                      <option value="KG">Kg</option>
                      <option value="L">Litros</option>
                    </Select>
                  </Field>

                  <Field label="Mínimo">
                    <div className="relative">
                      <Ruler className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                      <Input
                        value={minQtyCreate}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (isValidNumberDraft(v)) setMinQtyCreate(v);
                        }}
                        placeholder="0"
                        inputMode="decimal"
                        className="pl-9"
                      />
                    </div>
                    <div className="mt-1 text-xs text-zinc-500">
                      Tip: si es 0, no marca alertas por mínimo.
                    </div>
                  </Field>

                  <div className="flex items-end">
                    <Button
                      className="w-full"
                      onClick={create}
                      loading={busy}
                      disabled={busy || !name.trim() || !supplierId}
                    >
                      <span className="inline-flex items-center gap-2">
                        <Plus className="h-4 w-4" />
                        Crear
                      </span>
                    </Button>
                  </div>

                  <div className="flex items-end">
                    <Button
                      className="w-full"
                      variant="secondary"
                      disabled={busy}
                      onClick={() => {
                        setName("");
                        setUnit("UNIT");
                        setMinQtyCreate("0");
                        setErr(null);
                        setOk(null);
                      }}
                    >
                      Limpiar
                    </Button>
                  </div>
                </div>
              </CardBody>
            )}
          </Card>

          {/* Listado */}
          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <div className="border-b border-zinc-100 px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-zinc-900">Listado</h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    {filtered.length} producto(s) —{" "}
                    <span className="font-medium text-zinc-700">
                      {currentSupplierName}
                    </span>
                  </p>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-zinc-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Nombre
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Unidad
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Mínimo
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Estado
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Acciones
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-zinc-100">
                  {loading && (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-sm text-zinc-500">
                        Cargando…
                      </td>
                    </tr>
                  )}

                  {!loading && filtered.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-sm text-zinc-500">
                        No hay productos para este proveedor.
                      </td>
                    </tr>
                  )}

                  {!loading &&
                    filtered.map((p) => {
                      const minIsSaving = savingMinById[p.id] === true;
                      const isBelow = belowMin(p);

                      return (
                        <tr key={p.id} className="hover:bg-zinc-50/60">
                          {/* Nombre */}
                          <td className="px-4 py-3">
                            <div className="text-sm font-medium text-zinc-900">
                              {p.name}
                            </div>
                            <div className="mt-1 text-xs text-zinc-500">
                              {isBelow ? (
                                <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 font-semibold text-amber-700">
                                  <AlertTriangle className="h-3.5 w-3.5" />
                                  Bajo mínimo
                                </span>
                              ) : (
                                <span className="text-zinc-400">—</span>
                              )}
                            </div>
                          </td>

                          {/* Unidad */}
                          <td className="px-4 py-3">
                            <span className="rounded-full border border-zinc-200 bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-700">
                              {unitLabel(p.unit)}
                            </span>
                          </td>

                          {/* Mínimo */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <input
                                className={cn(
                                  "w-28 rounded-xl border px-3 py-2 text-sm outline-none focus:ring-4",
                                  isBelow
                                    ? "border-amber-300 bg-amber-50 text-amber-900 focus:border-amber-400 focus:ring-amber-100"
                                    : "border-zinc-200 bg-white text-zinc-900 focus:border-zinc-400 focus:ring-zinc-100"
                                )}
                                value={minDraft[p.id] ?? String(p.minQty ?? 0)}
                                onChange={(e) => setMinValue(p.id, e.target.value)}
                                placeholder="0"
                                inputMode="decimal"
                                disabled={busy || minIsSaving}
                              />
                              <Button
                                variant="secondary"
                                disabled={busy || minIsSaving}
                                loading={minIsSaving}
                                onClick={() => saveMin(p)}
                              >
                                <span className="inline-flex items-center gap-2">
                                  <Save className="h-4 w-4" />
                                  Guardar
                                </span>
                              </Button>
                            </div>
                          </td>

                          {/* Estado */}
                          <td className="px-4 py-3">
                            <StatusPill active={p.isActive} />
                          </td>

                          {/* Acciones */}
                          <td className="px-4 py-3">
                            <Button
                              variant={p.isActive ? "danger" : "secondary"}
                              disabled={busy || minIsSaving}
                              onClick={() => toggleActive(p)}
                            >
                              <span className="inline-flex items-center gap-2">
                                <Power className="h-4 w-4" />
                                {p.isActive ? "Desactivar" : "Reactivar"}
                              </span>
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>

            <div className="border-t border-zinc-100 px-5 py-4 text-sm text-zinc-500">
              Tip: el mínimo se usa en el conteo diario para marcar productos bajo stock.
            </div>
          </div>
        </div>
      </div>
    </AdminProtected>
  );
}
