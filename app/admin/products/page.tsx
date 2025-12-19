"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminProtected } from "@/components/AdminProtected";
import { useAuth } from "@/app/providers/AuthProvider";
import { apiFetchAuthed } from "@/lib/apiAuthed";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Field";

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

export default function AdminProductsPage() {
  const { getAccessToken } = useAuth();

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierId, setSupplierId] = useState("");

  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  // Crear
  const [name, setName] = useState("");
  const [unit, setUnit] = useState<Unit>("UNIT");
  const [minQtyCreate, setMinQtyCreate] = useState<string>("0");

  // Buscar
  const [q, setQ] = useState("");

  // Edit min
  const [minDraft, setMinDraft] = useState<Record<string, string>>({});
  const [savingMinById, setSavingMinById] = useState<Record<string, boolean>>(
    {}
  );

  const activeSuppliers = useMemo(
    () => suppliers.filter((s) => s.isActive !== false),
    [suppliers]
  );

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return items;
    return items.filter((p) => p.name.toLowerCase().includes(qq));
  }, [items, q]);

  async function loadSuppliers() {
    const s = await apiFetchAuthed<Supplier[]>(getAccessToken, "/suppliers");
    setSuppliers(s);

    // Autoselect 1er proveedor activo si no hay
    if (!supplierId) {
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
      await loadSuppliers();
      if (supplierId) await loadProducts(supplierId);
    } catch (e: any) {
      setErr(e?.message || "Error cargando");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
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
      await loadProducts(supplierId);
    } catch (e: any) {
      setErr(e?.message || "Error actualizando mínimo");
    } finally {
      setSavingMinById((prev) => ({ ...prev, [p.id]: false }));
    }
  }

  return (
    <AdminProtected>
      <div className="min-h-screen bg-zinc-50">
        <div className="mx-auto max-w-6xl px-4 py-8">
          <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-zinc-900">
                Admin • Productos
              </h1>
              <p className="mt-1 text-sm text-zinc-500">
                Cada producto pertenece a un proveedor, tiene unidad (Unidad/Kg/Litros) y mínimo.
              </p>
            </div>

            <Button
              variant="secondary"
              onClick={loadAll}
              loading={loading}
              disabled={busy}
            >
              Refrescar
            </Button>
          </div>

          {/* Crear */}
          <Card>
            <CardHeader
              title="Crear producto"
              subtitle="Se crea dentro del proveedor seleccionado"
            />
            <CardBody>
              <div className="grid gap-4 md:grid-cols-5">
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

                <Field label="Nombre">
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ej: Arroz para sushi"
                  />
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
                  <Input
                    value={minQtyCreate}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (isValidNumberDraft(v)) setMinQtyCreate(v);
                    }}
                    placeholder="0"
                    inputMode="decimal"
                  />
                </Field>

                <div className="flex items-end">
                  <Button
                    className="w-full"
                    onClick={create}
                    loading={busy}
                    disabled={busy || !name.trim() || !supplierId}
                  >
                    Crear
                  </Button>
                </div>
              </div>

              {(err || ok) && (
                <div
                  className={[
                    "mt-4 rounded-xl border px-3 py-2 text-sm",
                    err
                      ? "border-red-200 bg-red-50 text-red-700"
                      : "border-emerald-200 bg-emerald-50 text-emerald-700",
                  ].join(" ")}
                >
                  {err || ok}
                </div>
              )}
            </CardBody>
          </Card>

          {/* Listado */}
          <div className="mt-6 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <div className="border-b border-zinc-100 px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-zinc-900">
                    Listado
                  </h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    {filtered.length} producto(s) — Proveedor seleccionado
                  </p>
                </div>
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Buscar..."
                />
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

                      return (
                        <tr key={p.id} className="hover:bg-zinc-50/60">
                          <td className="px-4 py-3 text-sm font-medium text-zinc-900">
                            {p.name}
                          </td>

                          <td className="px-4 py-3">
                            <span className="rounded-full border border-zinc-200 bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-700">
                              {unitLabel(p.unit)}
                            </span>
                          </td>

                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <input
                                className="w-28 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400 focus:ring-4 focus:ring-zinc-100"
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
                                Guardar
                              </Button>
                            </div>
                          </td>

                          <td className="px-4 py-3">
                            <span
                              className={[
                                "rounded-full px-2.5 py-1 text-xs font-semibold border",
                                p.isActive
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : "bg-zinc-100 text-zinc-600 border-zinc-200",
                              ].join(" ")}
                            >
                              {p.isActive ? "ACTIVO" : "INACTIVO"}
                            </span>
                          </td>

                          <td className="px-4 py-3">
                            <Button
                              variant={p.isActive ? "danger" : "secondary"}
                              disabled={busy || minIsSaving}
                              onClick={() => toggleActive(p)}
                            >
                              {p.isActive ? "Desactivar" : "Reactivar"}
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
