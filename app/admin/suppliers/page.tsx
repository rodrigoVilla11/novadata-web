"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AdminProtected } from "@/components/AdminProtected";
import { useAuth } from "@/app/providers/AuthProvider";
import { apiFetchAuthed } from "@/lib/apiAuthed";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import {
  RefreshCcw,
  Search,
  Plus,
  Power,
  CheckCircle2,
  AlertTriangle,
  Truck,
  X,
  PackageSearch,
} from "lucide-react";

type Supplier = {
  id: string;
  name: string;
  isActive: boolean;
};

// ------------------------------
// Ingredients (frontend types)
// ------------------------------
type IngredientLite = {
  id: string;
  name: string;
  displayName?: string | null;
  baseUnit?: string | null;
  supplierId?: string | null;
  name_for_supplier?: string | null;
  cost?: { lastCost?: number; currency?: "ARS" | "USD" };
};

// ------------------------------
// Purchase Orders (frontend types)
// ------------------------------
type PurchaseOrderStatus =
  | "DRAFT"
  | "SENT"
  | "CONFIRMED"
  | "RECEIVED_PARTIAL"
  | "RECEIVED"
  | "CANCELLED";

type PurchaseOrderItem = {
  ingredientId: string;
  ingredientName?: string;
  name_for_supplier?: string | null;
  qty: number;
  unit?: string;
  approxUnitPrice?: number;
  approxLineTotal?: number;
  realUnitPrice?: number | null;
  realLineTotal?: number | null;
  receivedQty?: number;
  note?: string | null;
};

type PurchaseOrder = {
  id: string;
  supplierId: string;
  supplierName: string;
  status: PurchaseOrderStatus;
  orderDate: string;
  expectedDate?: string | null;
  notes?: string | null;
  totals?: {
    approxTotal: number;
    realTotal?: number | null;
    currency: "ARS" | "USD";
  };
  invoice?: {
    imageUrl?: string | null;
    invoiceNumber?: string | null;
    invoiceDate?: string | null;
  };
  items: PurchaseOrderItem[];
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
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

function OrderStatusPill({ status }: { status: PurchaseOrderStatus }) {
  const map: Record<PurchaseOrderStatus, { label: string; cls: string }> = {
    DRAFT: { label: "BORRADOR", cls: "bg-zinc-100 text-zinc-700 border-zinc-200" },
    SENT: { label: "ENVIADO", cls: "bg-blue-50 text-blue-700 border-blue-200" },
    CONFIRMED: { label: "CONFIRMADO", cls: "bg-indigo-50 text-indigo-700 border-indigo-200" },
    RECEIVED_PARTIAL: { label: "RECIBIDO PARCIAL", cls: "bg-amber-50 text-amber-700 border-amber-200" },
    RECEIVED: { label: "RECIBIDO", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    CANCELLED: { label: "CANCELADO", cls: "bg-red-50 text-red-700 border-red-200" },
  };

  const it = map[status] ?? map.DRAFT;

  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold border", it.cls)}>
      {it.label}
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

function money(n: number, currency: "ARS" | "USD" = "ARS") {
  const v = Number(n ?? 0) || 0;
  try {
    return v.toLocaleString("es-AR", { style: "currency", currency });
  } catch {
    return v.toLocaleString("es-AR");
  }
}

function prettyIngredientName(i: IngredientLite) {
  return (i.displayName || i.name || "").trim();
}

function IngredientPicker({
  open,
  onClose,
  supplier,
  getAccessToken,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  supplier: Supplier;
  getAccessToken: any;
  onPick: (ing: IngredientLite) => void;
}) {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<IngredientLite[]>([]);
  const [err, setErr] = useState<string | null>(null);

  async function loadList(query: string) {
    setLoading(true);
    setErr(null);
    try {
      // ✅ Asumimos endpoint /ingredients que devuelve [{id,name,displayName,baseUnit,supplierId,name_for_supplier,cost}]
      // Si tu endpoint es distinto, cambiá esta URL.
      const url = `/ingredients?limit=200&supplierId=${encodeURIComponent(
        supplier.id
      )}${query.trim() ? `&q=${encodeURIComponent(query.trim())}` : ""}`;

      const data = await apiFetchAuthed<IngredientLite[]>(getAccessToken, url);
      setItems(data);
    } catch (e: any) {
      setErr(e?.message || "Error cargando ingredientes");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    setQ("");
    setItems([]);
    loadList("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, supplier.id]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => loadList(q), 250);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute left-1/2 top-10 w-[min(920px,92vw)] -translate-x-1/2 rounded-3xl border border-zinc-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <div className="text-xs text-zinc-500">Seleccionar ingrediente</div>
            <div className="text-lg font-semibold text-zinc-900">
              {supplier.name}
            </div>
          </div>
          <Button variant="secondary" onClick={onClose}>
            <span className="inline-flex items-center gap-2">
              <X className="h-4 w-4" />
              Cerrar
            </span>
          </Button>
        </div>

        <div className="p-5 space-y-4">
          <div className="relative">
            <PackageSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar ingrediente…"
              className="pl-9"
            />
          </div>

          {err && <Notice tone="error">{err}</Notice>}

          <div className="max-h-[60vh] overflow-y-auto rounded-2xl border border-zinc-200">
            <table className="min-w-full">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Ingrediente
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Unidad
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Últ. costo
                  </th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>

              <tbody className="divide-y divide-zinc-100">
                {loading && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-sm text-zinc-500">
                      Cargando…
                    </td>
                  </tr>
                )}

                {!loading && items.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-sm text-zinc-500">
                      No hay ingredientes para este proveedor.
                    </td>
                  </tr>
                )}

                {!loading &&
                  items.map((ing) => (
                    <tr key={ing.id} className="hover:bg-zinc-50">
                      <td className="px-4 py-3">
                        <div className="text-sm font-semibold text-zinc-900">
                          {prettyIngredientName(ing)}
                        </div>
                        {ing.name_for_supplier && (
                          <div className="text-xs text-zinc-500">
                            Prov: {ing.name_for_supplier}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-700">
                        {ing.baseUnit || "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-700">
                        {money(ing.cost?.lastCost ?? 0, ing.cost?.currency ?? "ARS")}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          onClick={() => onPick(ing)}
                          variant="secondary"
                        >
                          Elegir
                        </Button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          <div className="text-xs text-zinc-500">
            Si tu endpoint de ingredientes no soporta <b>supplierId</b> o <b>q</b>, decime y lo adapto a tu API real.
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminSuppliersPage() {
  const { getAccessToken } = useAuth();

  const [items, setItems] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  // create supplier
  const [name, setName] = useState("");

  // search supplier
  const [q, setQ] = useState("");

  // ----------------------
  // Orders drawer state
  // ----------------------
  const [ordersOpen, setOrdersOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);

  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersBusy, setOrdersBusy] = useState(false);

  // create order form
  const [poNotes, setPoNotes] = useState("");
  const [poLines, setPoLines] = useState<
    Array<{
      ingredientId: string;
      ingredientLabel?: string;
      unit?: string | null;
      lastCost?: number;
      currency?: "ARS" | "USD";
      qty: string;
    }>
  >([{ ingredientId: "", qty: "" }]);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTargetIndex, setPickerTargetIndex] = useState<number | null>(null);

  // receive form
  const [receivePrices, setReceivePrices] = useState<Record<string, string>>({});
  const [receiveQtys, setReceiveQtys] = useState<Record<string, string>>({});

  // invoice url per order (controlled locally)
  const [invoiceUrlByOrder, setInvoiceUrlByOrder] = useState<Record<string, string>>({});

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return items;
    return items.filter((s) => s.name.toLowerCase().includes(qq));
  }, [items, q]);

  const totals = useMemo(() => {
    const total = items.length;
    const active = items.filter((s) => s.isActive).length;
    return { total, active, inactive: total - active };
  }, [items]);

  function flashOk(msg: string) {
    setOk(msg);
    window.setTimeout(() => setOk(null), 1600);
  }

  async function load() {
    setErr(null);
    setOk(null);
    setLoading(true);
    try {
      const data = await apiFetchAuthed<Supplier[]>(getAccessToken, "/suppliers");
      setItems(data);
      flashOk("Datos actualizados ✔");
    } catch (e: any) {
      setErr(e?.message || "Error cargando proveedores");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function create() {
    if (!name.trim()) return;

    setErr(null);
    setOk(null);
    setBusy(true);
    try {
      await apiFetchAuthed(getAccessToken, "/suppliers", {
        method: "POST",
        body: JSON.stringify({ name: name.trim() }),
      });

      setName("");
      flashOk("Proveedor creado ✔");
      await load();
    } catch (e: any) {
      setErr(e?.message || "Error creando proveedor");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(s: Supplier) {
    const next = !s.isActive;
    const confirmMsg = next
      ? `¿Reactivar "${s.name}"?`
      : `¿Desactivar "${s.name}"?\n\nNo aparecerá para cargar conteos.`;
    if (!window.confirm(confirmMsg)) return;

    setErr(null);
    setOk(null);
    setBusy(true);
    try {
      await apiFetchAuthed(getAccessToken, `/suppliers/${s.id}/active`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: next }),
      });

      flashOk(next ? "Proveedor reactivado ✔" : "Proveedor desactivado ✔");
      await load();
    } catch (e: any) {
      setErr(e?.message || "Error actualizando proveedor");
    } finally {
      setBusy(false);
    }
  }

  // ----------------------
  // Orders helpers
  // ----------------------
  async function loadOrders(supplierId: string) {
    setOrdersLoading(true);
    setErr(null);
    try {
      const data = await apiFetchAuthed<PurchaseOrder[]>(
        getAccessToken,
        `/purchase-orders?supplierId=${encodeURIComponent(supplierId)}&limit=100`
      );
      setOrders(data);

      const seed: Record<string, string> = {};
      for (const o of data) seed[o.id] = o.invoice?.imageUrl ?? "";
      setInvoiceUrlByOrder(seed);
    } catch (e: any) {
      setErr(e?.message || "Error cargando pedidos");
    } finally {
      setOrdersLoading(false);
    }
  }

  function openOrders(s: Supplier) {
    setSelectedSupplier(s);
    setOrdersOpen(true);
    setOrders([]);
    setPoNotes("");
    setPoLines([{ ingredientId: "", qty: "" }]);
    setReceivePrices({});
    setReceiveQtys({});
    setInvoiceUrlByOrder({});
    loadOrders(s.id);
  }

  function closeOrders() {
    setOrdersOpen(false);
    setSelectedSupplier(null);
    setOrders([]);
    setPoNotes("");
    setPoLines([{ ingredientId: "", qty: "" }]);
    setReceivePrices({});
    setReceiveQtys({});
    setInvoiceUrlByOrder({});
  }

  function addLine() {
    setPoLines((prev) => [...prev, { ingredientId: "", qty: "" }]);
  }

  function removeLine(i: number) {
    setPoLines((prev) => (prev.length <= 1 ? prev : prev.filter((_, idx) => idx !== i)));
  }

  function setLine(
    i: number,
    patch: Partial<{
      ingredientId: string;
      ingredientLabel?: string;
      unit?: string | null;
      lastCost?: number;
      currency?: "ARS" | "USD";
      qty: string;
    }>
  ) {
    setPoLines((prev) => prev.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  }

  function openPickerForLine(i: number) {
    setPickerTargetIndex(i);
    setPickerOpen(true);
  }

  function onPickIngredient(ing: IngredientLite) {
    const i = pickerTargetIndex;
    if (i == null) return;
    setLine(i, {
      ingredientId: ing.id,
      ingredientLabel: prettyIngredientName(ing),
      unit: ing.baseUnit ?? null,
      lastCost: ing.cost?.lastCost ?? 0,
      currency: ing.cost?.currency ?? "ARS",
    });
    setPickerOpen(false);
    setPickerTargetIndex(null);
  }

  async function createOrder() {
    if (!selectedSupplier) return;

    const itemsPayload = poLines
      .map((l) => ({
        ingredientId: l.ingredientId.trim(),
        qty: Number(l.qty),
      }))
      .filter((x) => x.ingredientId && Number.isFinite(x.qty) && x.qty > 0)
      .map((x) => ({
        ingredientId: x.ingredientId,
        qty: x.qty,
      }));

    if (!itemsPayload.length) {
      setErr("Agregá al menos 1 ingrediente con cantidad > 0");
      return;
    }

    setOrdersBusy(true);
    setErr(null);
    try {
      await apiFetchAuthed(getAccessToken, "/purchase-orders", {
        method: "POST",
        body: JSON.stringify({
          supplierId: selectedSupplier.id,
          notes: poNotes.trim() || null,
          items: itemsPayload,
        }),
      });
      flashOk("Pedido creado ✔");
      await loadOrders(selectedSupplier.id);

      // reset form
      setPoNotes("");
      setPoLines([{ ingredientId: "", qty: "" }]);
    } catch (e: any) {
      setErr(e?.message || "Error creando pedido");
    } finally {
      setOrdersBusy(false);
    }
  }

  async function setOrderStatus(orderId: string, status: PurchaseOrderStatus) {
    setOrdersBusy(true);
    setErr(null);
    try {
      await apiFetchAuthed(getAccessToken, `/purchase-orders/${orderId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      flashOk("Estado actualizado ✔");
      if (selectedSupplier) await loadOrders(selectedSupplier.id);
    } catch (e: any) {
      setErr(e?.message || "Error actualizando estado");
    } finally {
      setOrdersBusy(false);
    }
  }

  async function receiveOrder(order: PurchaseOrder) {
    const itemsPayload = (order.items || [])
      .map((it) => {
        const qtyStr = receiveQtys[it.ingredientId];
        const priceStr = receivePrices[it.ingredientId];

        const payload: any = { ingredientId: it.ingredientId };

        if (qtyStr != null && qtyStr.trim() !== "") payload.receivedQty = Number(qtyStr);
        if (priceStr != null && priceStr.trim() !== "") payload.realUnitPrice = Number(priceStr);

        const has = payload.receivedQty != null || payload.realUnitPrice != null;
        return has ? payload : null;
      })
      .filter(Boolean);

    if (!itemsPayload.length) {
      setErr("Cargá al menos una cantidad recibida o un precio real");
      return;
    }

    setOrdersBusy(true);
    setErr(null);
    try {
      await apiFetchAuthed(getAccessToken, `/purchase-orders/${order.id}/receive`, {
        method: "PATCH",
        body: JSON.stringify({ items: itemsPayload }),
      });
      flashOk("Recepción aplicada ✔ (stock actualizado)");
      if (selectedSupplier) await loadOrders(selectedSupplier.id);
    } catch (e: any) {
      setErr(e?.message || "Error aplicando recepción");
    } finally {
      setOrdersBusy(false);
    }
  }

  async function attachInvoice(orderId: string) {
    const imageUrl = (invoiceUrlByOrder[orderId] ?? "").trim();
    if (!imageUrl) {
      setErr("Pegá la URL de la factura primero");
      return;
    }

    setOrdersBusy(true);
    setErr(null);
    try {
      await apiFetchAuthed(getAccessToken, `/purchase-orders/${orderId}/invoice`, {
        method: "PATCH",
        body: JSON.stringify({ imageUrl }),
      });
      flashOk("Factura adjuntada ✔");
      if (selectedSupplier) await loadOrders(selectedSupplier.id);
    } catch (e: any) {
      setErr(e?.message || "Error adjuntando factura");
    } finally {
      setOrdersBusy(false);
    }
  }

  return (
    <AdminProtected>
      <div className="space-y-6">
        {/* Header */}
        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
                Proveedores
              </h1>
              <p className="mt-1 text-sm text-zinc-500">
                Creá y activá/desactivá proveedores para compras y conteos.
              </p>

              <div className="mt-4 flex flex-wrap gap-4 text-sm">
                <span className="text-zinc-700">
                  Total: <b>{totals.total}</b>
                </span>
                <span className="text-emerald-700">
                  Activos: <b>{totals.active}</b>
                </span>
                <span className="text-zinc-600">
                  Inactivos: <b>{totals.inactive}</b>
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                onClick={load}
                loading={loading}
                disabled={busy}
              >
                <span className="inline-flex items-center gap-2">
                  <RefreshCcw className="h-4 w-4" />
                </span>
              </Button>
            </div>
          </div>
        </div>

        {/* Notices */}
        {(err || ok) && (
          <div className="grid gap-2">
            {err && <Notice tone="error">{err}</Notice>}
            {!err && ok && <Notice tone="ok">{ok}</Notice>}
          </div>
        )}

        {/* Toolbar (Search) */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-4">
          <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar proveedor…"
                className="pl-9"
              />
            </div>

            <div className="text-sm text-zinc-500">
              {q.trim()
                ? `${filtered.length} de ${items.length}`
                : `${items.length} proveedor(es)`}
            </div>
          </div>
        </div>

        {/* Create */}
        <Card>
          <CardHeader title="Crear proveedor" subtitle="Nombre único" />
          <CardBody>
            <div className="grid gap-3 md:grid-cols-[1fr_160px]">
              <Field label="Nombre">
                <div className="relative">
                  <Truck className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ej: Proveedor A"
                    className="pl-9"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") create();
                    }}
                  />
                </div>
              </Field>

              <div className="flex items-end">
                <Button
                  className="w-full"
                  onClick={create}
                  loading={busy}
                  disabled={busy || !name.trim()}
                >
                  <span className="inline-flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    Crear
                  </span>
                </Button>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* List */}
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <div className="border-b border-zinc-100 px-5 py-4">
            <h2 className="text-lg font-semibold text-zinc-900">Listado</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Los proveedores inactivos no aparecen en conteos ni selecciones.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Nombre
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
                    <td colSpan={3} className="px-4 py-6 text-sm text-zinc-500">
                      Cargando…
                    </td>
                  </tr>
                )}

                {!loading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-sm text-zinc-500">
                      No hay proveedores.
                    </td>
                  </tr>
                )}

                {!loading &&
                  filtered.map((s) => (
                    <tr key={s.id} className="hover:bg-zinc-50 transition">
                      <td className="px-4 py-3 text-sm font-semibold text-zinc-900">
                        {s.name}
                      </td>

                      <td className="px-4 py-3">
                        <StatusPill active={s.isActive} />
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="secondary"
                            disabled={busy}
                            onClick={() => openOrders(s)}
                          >
                            <span className="inline-flex items-center gap-2">
                              <Truck className="h-4 w-4" />
                              Pedidos
                            </span>
                          </Button>

                          <Button
                            variant={s.isActive ? "danger" : "secondary"}
                            disabled={busy}
                            onClick={() => toggleActive(s)}
                          >
                            <span className="inline-flex items-center gap-2">
                              <Power className="h-4 w-4" />
                              {s.isActive ? "Desactivar" : "Reactivar"}
                            </span>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          <div className="border-t border-zinc-100 px-5 py-4 text-xs text-zinc-500">
            Tip: después le metemos “Orden / Alias / CUIT / Contacto” si querés y
            queda pro para compras.
          </div>
        </div>

        {/* Orders Drawer */}
        {ordersOpen && selectedSupplier && (
          <div className="fixed inset-0 z-50">
            {/* backdrop */}
            <div className="absolute inset-0 bg-black/30" onClick={closeOrders} />

            {/* panel */}
            <div className="absolute right-0 top-0 h-full w-full max-w-3xl bg-white shadow-xl">
              <div className="flex items-center justify-between border-b px-5 py-4">
                <div>
                  <div className="text-xs text-zinc-500">Pedidos a proveedor</div>
                  <div className="text-lg font-semibold text-zinc-900">
                    {selectedSupplier.name}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => loadOrders(selectedSupplier.id)}
                    disabled={ordersBusy}
                    loading={ordersLoading}
                  >
                    <span className="inline-flex items-center gap-2">
                      <RefreshCcw className="h-4 w-4" />
                      Actualizar
                    </span>
                  </Button>
                  <Button variant="secondary" onClick={closeOrders}>
                    Cerrar
                  </Button>
                </div>
              </div>

              <div className="h-[calc(100%-64px)] overflow-y-auto p-5 space-y-6">
                {/* Crear pedido */}
                <Card>
                  <CardHeader
                    title="Crear pedido"
                    subtitle="Elegí ingredientes del proveedor y definí cantidades."
                  />
                  <CardBody>
                    <div className="grid gap-3">
                      <Field label="Notas">
                        <Input
                          value={poNotes}
                          onChange={(e) => setPoNotes(e.target.value)}
                          placeholder="Ej: entrega mañana / pedir 2da marca / etc."
                        />
                      </Field>

                      <div className="grid gap-2">
                        {poLines.map((l, i) => (
                          <div
                            key={i}
                            className="grid gap-2 md:grid-cols-[1fr_160px_auto] items-end"
                          >
                            <Field label={i === 0 ? "Ingrediente" : ""}>
                              <div className="flex gap-2">
                                <Input
                                  value={
                                    l.ingredientLabel
                                      ? `${l.ingredientLabel} (${l.ingredientId.slice(-6)})`
                                      : l.ingredientId
                                  }
                                  onChange={(e) =>
                                    setLine(i, { ingredientId: e.target.value, ingredientLabel: undefined })
                                  }
                                  placeholder="Elegí un ingrediente…"
                                />
                                <Button
                                  variant="secondary"
                                  onClick={() => openPickerForLine(i)}
                                  disabled={ordersBusy}
                                >
                                  Buscar
                                </Button>
                              </div>
                              {l.unit && (
                                <div className="mt-1 text-xs text-zinc-500">
                                  Unidad: <b>{l.unit}</b>
                                  {typeof l.lastCost === "number" && (
                                    <>
                                      {" "}
                                      · Últ. costo: <b>{money(l.lastCost, l.currency ?? "ARS")}</b>
                                    </>
                                  )}
                                </div>
                              )}
                            </Field>

                            <Field label={i === 0 ? "Cantidad" : ""}>
                              <Input
                                value={l.qty}
                                onChange={(e) => setLine(i, { qty: e.target.value })}
                                placeholder="Ej: 30"
                                inputMode="decimal"
                              />
                            </Field>

                            <div className="flex gap-2">
                              <Button
                                variant="secondary"
                                onClick={() => removeLine(i)}
                                disabled={poLines.length === 1}
                              >
                                Quitar
                              </Button>

                              {i === poLines.length - 1 && (
                                <Button variant="secondary" onClick={addLine}>
                                  +
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="flex justify-end">
                        <Button
                          onClick={createOrder}
                          loading={ordersBusy}
                          disabled={ordersBusy}
                        >
                          Crear pedido
                        </Button>
                      </div>
                    </div>
                  </CardBody>
                </Card>

                {/* Listado pedidos */}
                <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden">
                  <div className="border-b px-5 py-4 flex items-center justify-between">
                    <div>
                      <div className="text-lg font-semibold text-zinc-900">Pedidos</div>
                      <div className="text-sm text-zinc-500">
                        Estados, recepción (actualiza stock/costo) y factura.
                      </div>
                    </div>
                    <div className="text-sm text-zinc-500">
                      {ordersLoading ? "Cargando…" : `${orders.length} pedido(s)`}
                    </div>
                  </div>

                  <div className="divide-y">
                    {ordersLoading && (
                      <div className="px-5 py-6 text-sm text-zinc-500">Cargando…</div>
                    )}

                    {!ordersLoading && orders.length === 0 && (
                      <div className="px-5 py-8 text-sm text-zinc-500">No hay pedidos.</div>
                    )}

                    {!ordersLoading &&
                      orders.map((o) => {
                        const curr = o.totals?.currency ?? "ARS";
                        const approx = o.totals?.approxTotal ?? 0;
                        const real = o.totals?.realTotal ?? null;

                        return (
                          <div key={o.id} className="p-5 space-y-3">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div className="space-y-1">
                                <div className="text-sm text-zinc-500">
                                  {new Date(o.orderDate).toLocaleString("es-AR")}
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                  <div className="text-base font-semibold text-zinc-900">
                                    Pedido #{o.id.slice(-6)}
                                  </div>
                                  <OrderStatusPill status={o.status} />
                                </div>

                                <div className="text-sm text-zinc-700">
                                  Aproximado: <b>{money(approx, curr)}</b>
                                  {real != null && (
                                    <>
                                      {" "}
                                      · Real: <b>{money(real, curr)}</b>
                                    </>
                                  )}
                                </div>

                                {o.invoice?.imageUrl && (
                                  <div className="text-sm">
                                    <a
                                      className="text-blue-600 underline"
                                      href={o.invoice.imageUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                    >
                                      Ver factura
                                    </a>
                                  </div>
                                )}

                                {o.notes && (
                                  <div className="text-xs text-zinc-500">
                                    Nota: {o.notes}
                                  </div>
                                )}
                              </div>

                              <div className="flex flex-wrap gap-2">
                                <Button
                                  variant="secondary"
                                  disabled={ordersBusy}
                                  onClick={() => setOrderStatus(o.id, "SENT")}
                                >
                                  ENVIADO
                                </Button>
                                <Button
                                  variant="secondary"
                                  disabled={ordersBusy}
                                  onClick={() => setOrderStatus(o.id, "CONFIRMED")}
                                >
                                  CONFIRMADO
                                </Button>
                                <Button
                                  variant="danger"
                                  disabled={ordersBusy}
                                  onClick={() => setOrderStatus(o.id, "CANCELLED")}
                                >
                                  CANCELAR
                                </Button>
                              </div>
                            </div>

                            {/* Items */}
                            <div className="overflow-x-auto rounded-xl border border-zinc-100">
                              <table className="min-w-full">
                                <thead className="bg-zinc-50">
                                  <tr>
                                    <th className="px-3 py-2 text-left text-xs font-semibold text-zinc-500">
                                      Ingrediente
                                    </th>
                                    <th className="px-3 py-2 text-left text-xs font-semibold text-zinc-500">
                                      Pedido
                                    </th>
                                    <th className="px-3 py-2 text-left text-xs font-semibold text-zinc-500">
                                      Recibido
                                    </th>
                                    <th className="px-3 py-2 text-left text-xs font-semibold text-zinc-500">
                                      Precio real
                                    </th>
                                  </tr>
                                </thead>

                                <tbody className="divide-y">
                                  {o.items.map((it) => (
                                    <tr key={it.ingredientId}>
                                      <td className="px-3 py-2 text-sm">
                                        <div className="font-semibold text-zinc-900">
                                          {it.ingredientName || it.ingredientId}
                                        </div>
                                        {it.name_for_supplier && (
                                          <div className="text-xs text-zinc-500">
                                            Prov: {it.name_for_supplier}
                                          </div>
                                        )}
                                      </td>

                                      <td className="px-3 py-2 text-sm text-zinc-700">
                                        {it.qty} {it.unit || ""}
                                      </td>

                                      <td className="px-3 py-2">
                                        <Input
                                          value={
                                            receiveQtys[it.ingredientId] ??
                                            String(it.receivedQty ?? "")
                                          }
                                          onChange={(e) =>
                                            setReceiveQtys((p) => ({
                                              ...p,
                                              [it.ingredientId]: e.target.value,
                                            }))
                                          }
                                          placeholder="Ej: 30"
                                          inputMode="decimal"
                                        />
                                      </td>

                                      <td className="px-3 py-2">
                                        <Input
                                          value={
                                            receivePrices[it.ingredientId] ??
                                            (it.realUnitPrice ?? "").toString()
                                          }
                                          onChange={(e) =>
                                            setReceivePrices((p) => ({
                                              ...p,
                                              [it.ingredientId]: e.target.value,
                                            }))
                                          }
                                          placeholder="Ej: 2550"
                                          inputMode="decimal"
                                        />
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>

                            {/* Factura + recibir */}
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:flex-1">
                                <Input
                                  value={invoiceUrlByOrder[o.id] ?? ""}
                                  onChange={(e) =>
                                    setInvoiceUrlByOrder((p) => ({
                                      ...p,
                                      [o.id]: e.target.value,
                                    }))
                                  }
                                  placeholder="URL factura (Cloudinary) — pegala acá"
                                />
                                <Button
                                  variant="secondary"
                                  onClick={() => attachInvoice(o.id)}
                                  disabled={ordersBusy}
                                >
                                  Guardar factura
                                </Button>
                              </div>

                              <Button
                                onClick={() => receiveOrder(o)}
                                loading={ordersBusy}
                                disabled={ordersBusy}
                              >
                                Aplicar recepción (stock)
                              </Button>
                            </div>

                            <div className="text-xs text-zinc-500">
                              Tip: para recepción parcial, cargá “Recibido” con lo que llegó hoy. El backend suma stock por diferencia.
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>

                <div className="text-xs text-zinc-500">
                  Próximo paso: en Stock armamos “Crear pedido” desde alertas (minQty/idealQty) y lo prellenamos.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Ingredient Picker Modal */}
        {pickerOpen && selectedSupplier && (
          <IngredientPicker
            open={pickerOpen}
            onClose={() => {
              setPickerOpen(false);
              setPickerTargetIndex(null);
            }}
            supplier={selectedSupplier}
            getAccessToken={getAccessToken}
            onPick={onPickIngredient}
          />
        )}
      </div>
    </AdminProtected>
  );
}
