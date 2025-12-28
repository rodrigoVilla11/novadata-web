"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AdminProtected } from "@/components/AdminProtected";
import { useAuth } from "@/app/providers/AuthProvider";
import { apiFetchAuthed } from "@/lib/apiAuthed";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
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

/* ============================================================================
 * Types
 * ========================================================================== */

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

/* ============================================================================
 * Helpers
 * ========================================================================== */

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

function Notice({
  tone,
  children,
}: {
  tone: "error" | "ok";
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border px-3 py-2 text-sm",
        tone === "error"
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-emerald-200 bg-emerald-50 text-emerald-700"
      )}
    >
      <span className="inline-flex items-center gap-2">
        {tone === "error" ? (
          <AlertTriangle className="h-4 w-4" />
        ) : (
          <CheckCircle2 className="h-4 w-4" />
        )}
        {children}
      </span>
    </div>
  );
}

/* ============================================================================
 * Page
 * ========================================================================== */

export default function AdminProductsPage() {
  const { getAccessToken } = useAuth();

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierId, setSupplierId] = useState("");

  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  // create
  const [createOpen, setCreateOpen] = useState(true);
  const [name, setName] = useState("");
  const [unit, setUnit] = useState<Unit>("UNIT");
  const [minQtyCreate, setMinQtyCreate] = useState("0");

  // search / filters
  const [q, setQ] = useState("");
  const [onlyActive, setOnlyActive] = useState(false);

  // min inline edit
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
    let base = items;
    if (onlyActive) base = base.filter((p) => p.isActive);
    if (!q.trim()) return base;
    return base.filter((p) =>
      p.name.toLowerCase().includes(q.trim().toLowerCase())
    );
  }, [items, q, onlyActive]);

  const totals = useMemo(() => {
    const total = items.length;
    const active = items.filter((p) => p.isActive).length;
    return { total, active, inactive: total - active };
  }, [items]);

  const currentSupplierName = useMemo(
    () => suppliers.find((s) => s.id === supplierId)?.name ?? "—",
    [suppliers, supplierId]
  );

  /* ============================================================================
   * Loaders
   * ========================================================================== */

  async function loadSuppliers(nextId?: string) {
    const s = await apiFetchAuthed<Supplier[]>(getAccessToken, "/suppliers");
    setSuppliers(s);

    if (!nextId) {
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
      setTimeout(() => setOk(null), 1600);
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
        await loadSuppliers("");
      } catch (e: any) {
        setErr(e?.message || "Error cargando proveedores");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!supplierId) return;
    (async () => {
      setLoading(true);
      try {
        await loadProducts(supplierId);
      } catch (e: any) {
        setErr(e?.message || "Error cargando productos");
      } finally {
        setLoading(false);
      }
    })();
  }, [supplierId]);

  /* ============================================================================
   * Actions
   * ========================================================================== */

  async function create() {
    if (!name.trim() || !supplierId) return;

    const minQty = Number(minQtyCreate || 0);
    if (!Number.isFinite(minQty) || minQty < 0) {
      setErr("El mínimo debe ser un número >= 0");
      return;
    }

    setBusy(true);
    try {
      await apiFetchAuthed(getAccessToken, "/products", {
        method: "POST",
        body: JSON.stringify({ name, unit, supplierId, minQty }),
      });

      setName("");
      setUnit("UNIT");
      setMinQtyCreate("0");
      setOk("Producto creado ✔");
      setTimeout(() => setOk(null), 1600);
      await loadProducts(supplierId);
    } catch (e: any) {
      setErr(e?.message || "Error creando producto");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(p: Product) {
    const next = !p.isActive;
    if (
      !window.confirm(
        next
          ? `¿Reactivar "${p.name}"?`
          : `¿Desactivar "${p.name}"?\n\nNo aparecerá para conteo.`
      )
    )
      return;

    setBusy(true);
    try {
      await apiFetchAuthed(getAccessToken, `/products/${p.id}/active`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: next }),
      });
      await loadProducts(supplierId);
    } finally {
      setBusy(false);
    }
  }

  function setMinValue(id: string, v: string) {
    if (isValidNumberDraft(v))
      setMinDraft((prev) => ({ ...prev, [id]: v }));
  }

  async function saveMin(p: Product) {
    const raw = minDraft[p.id] ?? "0";
    const minQty = Number(raw || 0);
    if (!Number.isFinite(minQty) || minQty < 0) {
      setErr("El mínimo debe ser un número >= 0");
      return;
    }

    setSavingMinById((prev) => ({ ...prev, [p.id]: true }));
    try {
      await apiFetchAuthed(getAccessToken, `/products/${p.id}/min`, {
        method: "PATCH",
        body: JSON.stringify({ minQty }),
      });
      await loadProducts(supplierId);
    } finally {
      setSavingMinById((prev) => ({ ...prev, [p.id]: false }));
    }
  }

  /* ============================================================================
   * Render
   * ========================================================================== */

  return (
    <AdminProtected>
      <div className="space-y-6">
        {/* Header */}
        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            Productos
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Gestión por proveedor, unidad y stock mínimo.
          </p>

          <div className="mt-4 flex flex-wrap gap-4 text-sm">
            <span>Proveedor: <b>{currentSupplierName}</b></span>
            <span>Totales: <b>{totals.total}</b></span>
            <span className="text-emerald-700">Activos: <b>{totals.active}</b></span>
            <span className="text-zinc-600">Inactivos: <b>{totals.inactive}</b></span>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="secondary" onClick={loadAll} loading={loading}>
              <RefreshCcw className="h-4 w-4" />
            
            </Button>
          </div>
        </div>

        {(err || ok) && (
          <div className="grid gap-2">
            {err && <Notice tone="error">{err}</Notice>}
            {!err && ok && <Notice tone="ok">{ok}</Notice>}
          </div>
        )}

        {/* Filters */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-4">
          <div className="grid gap-2 sm:grid-cols-[260px_1fr_auto] sm:items-center">
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
                "h-10 rounded-xl border px-3 text-sm font-semibold inline-flex items-center gap-2",
                onlyActive
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50"
              )}
            >
              <Filter className="h-4 w-4" />
              {onlyActive ? "Solo activos" : "Todos"}
            </button>
          </div>
        </div>

        {/* Create */}
        <Card>
          <div className="flex items-start justify-between px-5 pt-5">
            <div>
              <div className="text-base font-semibold">Crear producto</div>
              <div className="text-sm text-zinc-500">
                Dentro del proveedor seleccionado
              </div>
            </div>
            <button
              onClick={() => setCreateOpen((v) => !v)}
              className="rounded-xl border px-3 py-2 text-sm hover:bg-zinc-50"
            >
              {createOpen ? "Ocultar" : "Mostrar"}
            </button>
          </div>

          {createOpen && (
            <CardBody>
              <div className="grid gap-4 md:grid-cols-5">
                <Field label="Nombre">
                  <Input value={name} onChange={(e) => setName(e.target.value)} />
                </Field>

                <Field label="Unidad">
                  <Select value={unit} onChange={(e) => setUnit(e.target.value as Unit)}>
                    <option value="UNIT">Unidad</option>
                    <option value="KG">Kg</option>
                    <option value="L">Litros</option>
                  </Select>
                </Field>

                <Field label="Mínimo">
                  <Input
                    value={minQtyCreate}
                    onChange={(e) => isValidNumberDraft(e.target.value) && setMinQtyCreate(e.target.value)}
                  />
                </Field>

                <div className="flex items-end">
                  <Button onClick={create} disabled={busy || !name}>
                    <Plus className="h-4 w-4" />
                    Crear
                  </Button>
                </div>
              </div>
            </CardBody>
          )}
        </Card>

        {/* List */}
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <table className="min-w-full">
            <thead className="bg-zinc-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">Nombre</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">Unidad</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">Mínimo</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">Estado</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">Acciones</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-zinc-100">
              {filtered.map((p) => {
                const saving = savingMinById[p.id];
                return (
                  <tr key={p.id} className="hover:bg-zinc-50">
                    <td className="px-4 py-3 font-medium">{p.name}</td>
                    <td className="px-4 py-3">{unitLabel(p.unit)}</td>
                    <td className="px-4 py-3 flex gap-2">
                      <input
                        className="w-24 rounded-xl border px-3 py-2 text-sm"
                        value={minDraft[p.id] ?? "0"}
                        onChange={(e) => setMinValue(p.id, e.target.value)}
                      />
                      <Button
                        variant="secondary"
                        loading={saving}
                        onClick={() => saveMin(p)}
                      >
                        <Save className="h-4 w-4" />
                      </Button>
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill active={p.isActive} />
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        variant={p.isActive ? "danger" : "secondary"}
                        onClick={() => toggleActive(p)}
                      >
                        <Power className="h-4 w-4" />
                        {p.isActive ? "Desactivar" : "Reactivar"}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </AdminProtected>
  );
}
