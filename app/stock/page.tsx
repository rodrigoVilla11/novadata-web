"use client";

import { useEffect, useMemo, useState } from "react";
import { Protected } from "@/components/Protected";
import { useAuth } from "@/app/providers/AuthProvider";
import { apiFetchAuthed } from "@/lib/apiAuthed";
import { todayKey } from "@/lib/dateKey";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Field";

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
  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const activeSuppliers = useMemo(
    () => suppliers.filter((s) => s.isActive !== false),
    [suppliers]
  );

  const activeProducts = useMemo(
    () => products.filter((p) => p.isActive !== false),
    [products]
  );

  // 1) cargar suppliers
  useEffect(() => {
    (async () => {
      setErr(null);
      setLoading(true);
      try {
        const s = await apiFetchAuthed<Supplier[]>(
          getAccessToken,
          "/suppliers"
        );
        setSuppliers(s);
        // auto-select el primero
        const first = s.find((x) => x.isActive !== false);
        if (first) setSupplierId(first.id);
      } catch (e: any) {
        setErr(e?.message || "Error cargando proveedores");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2) cuando cambia supplierId: cargar productos + snapshot
  useEffect(() => {
    if (!supplierId) return;

    (async () => {
      setErr(null);
      setOkMsg(null);
      setLoading(true);

      try {
        const prods = await apiFetchAuthed<Product[]>(
          getAccessToken,
          `/products?supplierId=${encodeURIComponent(supplierId)}`
        );
        setProducts(prods);

        // snapshot (puede ser null)
        const snap = await apiFetchAuthed<Snapshot | null>(
          getAccessToken,
          `/stock-snapshots?dateKey=${encodeURIComponent(
            dateKey
          )}&supplierId=${encodeURIComponent(supplierId)}`
        );

        // armar qtyByProductId: por defecto vacío/0, pero si hay snapshot se precarga
        const map: Record<string, string> = {};
        for (const p of prods) {
          map[p.id] = ""; // vacío (si querés 0, poné "0")
        }
        if (snap?.items?.length) {
          for (const it of snap.items) {
            map[it.productId] = String(it.qty ?? "");
          }
        }
        setQtyByProductId(map);
      } catch (e: any) {
        setErr(e?.message || "Error cargando productos o conteo");
      } finally {
        setLoading(false);
      }
    })();
  }, [supplierId, dateKey, getAccessToken]);

  function setQty(productId: string, v: string) {
    // permitimos "", "12", "12.5"
    if (v === "" || /^[0-9]*([.][0-9]*)?$/.test(v)) {
      setQtyByProductId((prev) => ({ ...prev, [productId]: v }));
    }
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
        body: JSON.stringify({
          dateKey,
          supplierId,
          items,
        }),
      });

      setOkMsg("Guardado ✔");
    } catch (e: any) {
      setErr(e?.message || "Error guardando");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Protected>
      <div className="min-h-screen bg-zinc-50">
        <div className="mx-auto max-w-6xl px-4 py-8">
          <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-zinc-900">
                Conteo diario de stock
              </h1>
              <p className="mt-1 text-sm text-zinc-500">
                Guardás un snapshot por día y proveedor (histórico).
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

          <Card>
            <CardHeader title="Filtros" subtitle="Elegí fecha y proveedor" />
            <CardBody>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Fecha (YYYY-MM-DD)">
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

              {err && (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {err}
                </div>
              )}
              {okMsg && (
                <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                  {okMsg}
                </div>
              )}

              {/* Resumen bajo mínimo */}
              {!loading && activeProducts.length > 0 && (
                <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
                  {(() => {
                    const below = activeProducts.filter((p) => {
                      const raw = qtyByProductId[p.id] ?? "";
                      const n = raw === "" ? 0 : Number(raw);
                      const min = Number((p as any).minQty ?? 0);
                      return min > 0 && Number.isFinite(n) && n < min;
                    }).length;

                    if (below === 0) {
                      return (
                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-emerald-700">
                          Todo OK: no hay productos bajo mínimo
                        </span>
                      );
                    }

                    return (
                      <span className="rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-red-700">
                        Atención: {below} producto(s) bajo mínimo
                      </span>
                    );
                  })()}
                </div>
              )}
            </CardBody>
          </Card>

          <div className="mt-6 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <div className="border-b border-zinc-100 px-5 py-4">
              <h2 className="text-lg font-semibold text-zinc-900">Productos</h2>
              <p className="mt-1 text-sm text-zinc-500">
                Anotá la cantidad actual (según unidad del producto). Si está
                por debajo del mínimo, se marca en rojo.
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
                      Cantidad
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-zinc-100">
                  {loading && (
                    <tr>
                      <td
                        colSpan={3}
                        className="px-4 py-6 text-sm text-zinc-500"
                      >
                        Cargando…
                      </td>
                    </tr>
                  )}

                  {!loading && activeProducts.length === 0 && (
                    <tr>
                      <td
                        colSpan={3}
                        className="px-4 py-6 text-sm text-zinc-500"
                      >
                        No hay productos para este proveedor.
                      </td>
                    </tr>
                  )}

                  {!loading &&
                    activeProducts.map((p) => {
                      const raw = qtyByProductId[p.id] ?? "";
                      const n = raw === "" ? 0 : Number(raw);
                      const min = Number((p as any).minQty ?? 0);
                      const isBelowMin =
                        min > 0 && Number.isFinite(n) && n < min;

                      return (
                        <tr key={p.id} className="hover:bg-zinc-50/60">
                          <td className="px-4 py-3 text-sm font-medium text-zinc-900">
                            <div className="flex flex-col">
                              <span>{p.name}</span>
                              {min > 0 && (
                                <span
                                  className={[
                                    "mt-1 text-xs",
                                    isBelowMin
                                      ? "text-red-600"
                                      : "text-zinc-500",
                                  ].join(" ")}
                                >
                                  Mín: {min}
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="px-4 py-3">
                            <span className="rounded-full border border-zinc-200 bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-700">
                              {unitLabel(p.unit)}
                            </span>
                          </td>

                          <td className="px-4 py-3">
                            <input
                              className={[
                                "w-40 rounded-xl border px-3 py-2 text-sm outline-none focus:ring-4",
                                isBelowMin
                                  ? "border-red-300 bg-red-50 text-red-900 focus:border-red-400 focus:ring-red-100"
                                  : "border-zinc-200 bg-white text-zinc-900 focus:border-zinc-400 focus:ring-zinc-100",
                              ].join(" ")}
                              value={raw}
                              onChange={(e) => setQty(p.id, e.target.value)}
                              placeholder="0"
                              inputMode="decimal"
                            />
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>

            <div className="border-t border-zinc-100 px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-zinc-500">
                  Tip: podés guardar varias veces el mismo día (upsert).
                </p>
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
      </div>
    </Protected>
  );
}
