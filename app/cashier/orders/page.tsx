"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AdminProtected } from "@/components/AdminProtected";
import { useAuth } from "@/app/providers/AuthProvider";
import { apiFetchAuthed } from "@/lib/apiAuthed";

import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Field";

import {
  RefreshCcw,
  Search,
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  Banknote,
  BadgeDollarSign,
  Truck,
  Store,
  PackageOpen,
  User,
  Phone,
  MapPin,
  X,
  ClipboardList,
} from "lucide-react";

/* =============================================================================
 * Helpers
 * ========================================================================== */

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function todayKeyArgentina() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Cordoba",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function moneyARS(n: number) {
  const v = Number(n ?? 0) || 0;
  return v.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
}

function num(v: any) {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function isValidNumberDraft(v: string) {
  return v === "" || /^[0-9]*([.][0-9]*)?$/.test(v);
}

function looksForbidden(msg: string) {
  const m = (msg || "").toLowerCase();
  return (
    m.includes("forbidden") ||
    m.includes("sin permisos") ||
    m.includes("prohibido")
  );
}

function Notice({
  tone,
  children,
}: {
  tone: "error" | "ok" | "warn";
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border px-3 py-2 text-sm",
        tone === "error"
          ? "border-red-200 bg-red-50 text-red-700"
          : tone === "warn"
          ? "border-amber-200 bg-amber-50 text-amber-800"
          : "border-emerald-200 bg-emerald-50 text-emerald-700"
      )}
    >
      <span className="inline-flex items-center gap-2">
        {tone === "error" ? (
          <AlertTriangle className="h-4 w-4" />
        ) : tone === "warn" ? (
          <AlertTriangle className="h-4 w-4" />
        ) : (
          <CheckCircle2 className="h-4 w-4" />
        )}
        {children}
      </span>
    </div>
  );
}

/* =============================================================================
 * Types
 * ========================================================================== */

type Fulfillment = "DINE_IN" | "TAKEAWAY" | "DELIVERY";
type PaymentMethod = "CASH" | "TRANSFER" | "CARD" | "OTHER";

type CustomerSnapshot = {
  name?: string | null;
  phone?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  notes?: string | null;
};

type OrderItem = {
  productId: string;
  qty: number;
  note?: string | null;
  // opcional si tu backend trae nombre/precio
  name?: string | null;
  unitPrice?: number | null;
};

type OrderRow = {
  id: string;
  status?: string | null;
  createdAt: string;
  fulfillment?: Fulfillment | null;
  note?: string | null;
  customerSnapshot?: CustomerSnapshot | null;
  total?: number | null;
  items?: OrderItem[] | null;
};

type OrderDetail = OrderRow & { items: OrderItem[] };

type PosPaymentDraft = {
  method: PaymentMethod;
  amount: number;
  note?: string | null;
};

type CheckoutResult = { order: any; sale: any };

/* =============================================================================
 * Pay Modal (checkout desde order)
 * ========================================================================== */

function PayOrderModal({
  open,
  onClose,
  busy,
  order,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  busy?: boolean;
  order: OrderDetail | null;
  onConfirm: (data: {
    concept: string;
    note: string | null;
    payments: PosPaymentDraft[];
  }) => Promise<void> | void;
}) {
  const [payments, setPayments] = useState<PosPaymentDraft[]>([
    { method: "CASH", amount: 0 },
  ]);
  const [concept, setConcept] = useState("VENTA POS");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!open) return;
    setPayments([{ method: "CASH", amount: 0 }]);
    setConcept("VENTA POS");
    setNote("");
  }, [open]);

  const paymentsTotal = useMemo(
    () => payments.reduce((acc, p) => acc + num(p.amount), 0),
    [payments]
  );

  function addPaymentLine() {
    setPayments((prev) => [
      ...prev,
      { method: "TRANSFER", amount: 0, note: null },
    ]);
  }

  function removePaymentLine(ix: number) {
    setPayments((prev) => prev.filter((_, i) => i !== ix));
  }

  function updatePayment(ix: number, patch: Partial<PosPaymentDraft>) {
    setPayments((prev) => {
      const copy = [...prev];
      copy[ix] = { ...copy[ix], ...patch };
      return copy;
    });
  }

  const paymentIcon = (m: PaymentMethod) => {
    if (m === "CASH") return <Banknote className="h-4 w-4" />;
    if (m === "TRANSFER") return <BadgeDollarSign className="h-4 w-4" />;
    if (m === "CARD") return <CreditCard className="h-4 w-4" />;
    return <BadgeDollarSign className="h-4 w-4" />;
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-60 flex items-end justify-center bg-black/40 p-4 md:items-center">
      <div className="w-full max-w-2xl rounded-3xl bg-white shadow-xl border border-zinc-200">
        <div className="px-5 py-4 border-b border-zinc-100">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <BadgeDollarSign className="h-5 w-5 text-emerald-700" />
                <h3 className="text-lg font-semibold text-zinc-900">
                  Cobrar pedido
                </h3>
              </div>
              <div className="mt-1 text-sm text-zinc-500 truncate">
                Order ID: <b className="text-zinc-700">{order?.id}</b>
              </div>
            </div>

            <Button variant="secondary" onClick={onClose} disabled={!!busy}>
              <X className="h-4 w-4" />
              Cerrar
            </Button>
          </div>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
            <div className="text-sm text-zinc-600 flex flex-wrap gap-3">
              <span className="inline-flex items-center gap-2">
                <ClipboardList className="h-4 w-4" />
                Ítems:{" "}
                <b className="text-zinc-900">{order?.items?.length ?? 0}</b>
              </span>

              {order?.customerSnapshot?.name ? (
                <>
                  <span className="text-zinc-400">·</span>
                  <span className="inline-flex items-center gap-2">
                    <User className="h-4 w-4" />
                    <b className="text-zinc-900">
                      {order.customerSnapshot.name}
                    </b>
                  </span>
                </>
              ) : null}

              {order?.customerSnapshot?.phone ? (
                <>
                  <span className="text-zinc-400">·</span>
                  <span className="inline-flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    <b className="text-zinc-900">
                      {order.customerSnapshot.phone}
                    </b>
                  </span>
                </>
              ) : null}
            </div>
          </div>

          <div className="space-y-3">
            {payments.map((p, ix) => (
              <div
                key={ix}
                className="rounded-2xl border border-zinc-200 bg-white p-3"
              >
                <div className="grid gap-3 md:grid-cols-4">
                  <Field label="Método">
                    <Select
                      value={p.method}
                      onChange={(e) =>
                        updatePayment(ix, {
                          method: e.target.value as PaymentMethod,
                        })
                      }
                      disabled={!!busy}
                    >
                      <option value="CASH">Efectivo</option>
                      <option value="TRANSFER">Transferencia</option>
                      <option value="CARD">Tarjeta</option>
                      <option value="OTHER">Otro</option>
                    </Select>
                  </Field>

                  <Field label="Monto">
                    <Input
                      value={String(p.amount ?? 0)}
                      onChange={(e) => {
                        if (!isValidNumberDraft(e.target.value)) return;
                        updatePayment(ix, { amount: num(e.target.value) });
                      }}
                      disabled={!!busy}
                    />
                  </Field>

                  <Field label="Nota (pago)">
                    <Input
                      value={p.note ?? ""}
                      onChange={(e) =>
                        updatePayment(ix, { note: e.target.value })
                      }
                      placeholder="Opcional"
                      disabled={!!busy}
                    />
                  </Field>

                  <div className="flex items-end justify-end gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => removePaymentLine(ix)}
                      disabled={!!busy || payments.length <= 1}
                    >
                      Quitar
                    </Button>
                  </div>
                </div>

                <div className="mt-2 text-xs text-zinc-500 inline-flex items-center gap-2">
                  {paymentIcon(p.method)}
                  {p.method} · {moneyARS(p.amount)}
                </div>
              </div>
            ))}

            <Button
              variant="secondary"
              onClick={addPaymentLine}
              disabled={!!busy}
            >
              Agregar pago
            </Button>

            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Concepto (caja)">
                <Input
                  value={concept}
                  onChange={(e) => setConcept(e.target.value)}
                  disabled={!!busy}
                />
              </Field>

              <Field label="Nota general (opcional)">
                <Input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  disabled={!!busy}
                />
              </Field>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm">
              <div className="flex items-center justify-between">
                <span>Total pagos</span>
                <b className="text-zinc-900">{moneyARS(paymentsTotal)}</b>
              </div>
              <div className="mt-2 text-xs text-zinc-500">
                * El backend valida que el pago cubra el total.
              </div>
            </div>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-zinc-100 flex items-center justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={!!busy}>
            Cancelar
          </Button>
          <Button
            loading={!!busy}
            disabled={!!busy || !order}
            onClick={async () => {
              const payload = payments
                .map((p) => ({
                  method: p.method,
                  amount: num(p.amount),
                  note: p.note ?? null,
                }))
                .filter((p) => p.amount > 0);

              if (!payload.length) return;

              await onConfirm({
                concept: concept?.trim() ? concept.trim() : "VENTA POS",
                note: note?.trim() ? note.trim() : null,
                payments: payload,
              });
            }}
          >
            Confirmar cobro
          </Button>
        </div>
      </div>
    </div>
  );
}

/* =============================================================================
 * Drawer (panel lateral)
 * ========================================================================== */

function OrderDrawer({
  open,
  onClose,
  busy,
  loading,
  order,
  onPay,
}: {
  open: boolean;
  onClose: () => void;
  busy?: boolean;
  loading?: boolean;
  order: OrderDetail | null;
  onPay: () => void;
}) {
  if (!open) return null;

  const f = order?.fulfillment ?? "TAKEAWAY";
  const fMeta =
    f === "DELIVERY"
      ? { label: "Delivery", icon: <Truck className="h-4 w-4" /> }
      : f === "DINE_IN"
      ? { label: "Salón", icon: <Store className="h-4 w-4" /> }
      : { label: "Take-away", icon: <PackageOpen className="h-4 w-4" /> };

  return (
    <div className="fixed inset-0 z-50">
      {/* overlay */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={() => (!busy ? onClose() : null)}
      />

      {/* panel */}
      <div className="absolute right-0 top-0 h-full w-full max-w-xl bg-white shadow-2xl border-l border-zinc-200 flex flex-col">
        <div className="px-5 py-4 border-b border-zinc-100 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-zinc-700" />
              <h3 className="text-lg font-semibold text-zinc-900">Pedido</h3>
            </div>
            <div className="mt-1 text-xs text-zinc-500 truncate">
              ID: <b className="text-zinc-700">{order?.id ?? "—"}</b>
            </div>
          </div>

          <Button variant="secondary" onClick={onClose} disabled={!!busy}>
            <X className="h-4 w-4" />
            Cerrar
          </Button>
        </div>

        <div className="p-5 overflow-auto flex-1 space-y-4">
          {loading ? (
            <div className="text-sm text-zinc-500">Cargando detalle…</div>
          ) : !order ? (
            <div className="text-sm text-zinc-500">No hay detalle.</div>
          ) : (
            <>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <div className="text-sm text-zinc-600 flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center gap-2">
                    {fMeta.icon} <b className="text-zinc-900">{fMeta.label}</b>
                  </span>
                  <span className="text-zinc-400">·</span>
                  <span>
                    Estado:{" "}
                    <b className="text-zinc-900">{order.status ?? "—"}</b>
                  </span>
                </div>

                <div className="mt-3 grid gap-2 text-sm">
                  {order.customerSnapshot?.name ? (
                    <div className="inline-flex items-center gap-2 text-zinc-700">
                      <User className="h-4 w-4 text-zinc-400" />
                      {order.customerSnapshot.name}
                    </div>
                  ) : null}

                  {order.customerSnapshot?.phone ? (
                    <div className="inline-flex items-center gap-2 text-zinc-700">
                      <Phone className="h-4 w-4 text-zinc-400" />
                      {order.customerSnapshot.phone}
                    </div>
                  ) : null}

                  {order.fulfillment === "DELIVERY" &&
                  order.customerSnapshot?.addressLine1 ? (
                    <div className="inline-flex items-center gap-2 text-zinc-700">
                      <MapPin className="h-4 w-4 text-zinc-400" />
                      {order.customerSnapshot.addressLine1}
                      {order.customerSnapshot.addressLine2
                        ? ` · ${order.customerSnapshot.addressLine2}`
                        : ""}
                    </div>
                  ) : null}

                  {order.note ? (
                    <div className="text-xs text-zinc-500">
                      Nota: <span className="text-zinc-700">{order.note}</span>
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Items */}
              <div className="rounded-2xl border border-zinc-200 bg-white">
                <div className="px-4 py-3 border-b border-zinc-100">
                  <div className="text-sm font-semibold text-zinc-900">
                    Ítems ({order.items.length})
                  </div>
                </div>
                <div className="p-4 space-y-2">
                  {order.items.length === 0 ? (
                    <div className="text-sm text-zinc-500">Sin ítems.</div>
                  ) : (
                    order.items.map((it, i) => (
                      <div
                        key={`${it.productId}-${i}`}
                        className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-zinc-900 truncate">
                              {it.name ?? it.productId}
                            </div>
                            <div className="text-xs text-zinc-500">
                              Qty: <b>{it.qty}</b>
                              {it.unitPrice != null ? (
                                <>
                                  {" "}
                                  · Unit: <b>{moneyARS(it.unitPrice)}</b>
                                </>
                              ) : null}
                            </div>
                            {it.note ? (
                              <div className="mt-1 text-xs text-zinc-500">
                                Nota: {it.note}
                              </div>
                            ) : null}
                          </div>
                          <div className="text-xs text-zinc-400">
                            {it.productId}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Total (si existe) */}
              {order.total != null ? (
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-600">Total</span>
                    <b className="text-zinc-900">{moneyARS(order.total)}</b>
                  </div>
                  <div className="mt-2 text-xs text-zinc-500">
                    Si tu backend no trae total en Order, igual podés cobrar: el
                    checkout calcula/valida.
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>

        {/* footer actions */}
        <div className="p-5 border-t border-zinc-100 flex items-center justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={!!busy}>
            Cerrar
          </Button>
          <Button onClick={onPay} disabled={!!busy || !!loading || !order}>
            <BadgeDollarSign className="h-4 w-4" />
            Cobrar
          </Button>
        </div>
      </div>
    </div>
  );
}

/* =============================================================================
 * Cashier Orders Page
 * ========================================================================== */

export default function CashierOrdersPage() {
  const { getAccessToken, user } = useAuth();

  const roles = (user?.roles ?? []).map((r: any) => String(r).toUpperCase());
  const canUse =
    roles.includes("CASHIER") ||
    roles.includes("MANAGER") ||
    roles.includes("ADMIN");

  const todayKey = useMemo(() => todayKeyArgentina(), []);
  const [q, setQ] = useState("");

  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  // drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<OrderDetail | null>(null);

  // pay modal state
  const [payOpen, setPayOpen] = useState(false);

  function fulfillmentLabel(f?: string | null) {
    if (f === "DELIVERY")
      return { label: "Delivery", icon: <Truck className="h-4 w-4" /> };
    if (f === "DINE_IN")
      return { label: "Salón", icon: <Store className="h-4 w-4" /> };
    return { label: "Take-away", icon: <PackageOpen className="h-4 w-4" /> };
  }

  async function loadOrdersToday() {
    setLoading(true);
    setErr(null);

    try {
      const qs = new URLSearchParams();
      qs.set("dateKey", todayKey);
      qs.set("limit", "50");
      if (q.trim()) qs.set("q", q.trim());

      const rows = await apiFetchAuthed<any[]>(
        getAccessToken,
        `/orders?${qs.toString()}`
      );

      const norm: OrderRow[] = (rows ?? []).map((o: any) => ({
        id: String(o.id ?? o._id),
        status: o.status ?? null,
        createdAt: o.createdAt ?? o.created_at ?? new Date().toISOString(),
        fulfillment: (o.fulfillment ?? o.type ?? null) as any,
        note: o.note ?? null,
        customerSnapshot: o.customerSnapshot ?? o.customer_snapshot ?? null,
        total: o.total ?? o.amount ?? o.totals?.net ?? null,
        items: o.items ?? null,
      }));

      setOrders(norm);
    } catch (e: any) {
      const msg = String(e?.message || "Error cargando pedidos");
      setErr(looksForbidden(msg) ? "Sin permisos para ver pedidos." : msg);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }

  async function openDrawer(orderId: string) {
    setErr(null);
    setOk(null);

    setSelectedOrderId(orderId);
    setSelectedOrder(null);
    setDrawerOpen(true);
    setDrawerLoading(true);

    try {
      const detail = await apiFetchAuthed<any>(
        getAccessToken,
        `/orders/${orderId}`
      );
      const d: OrderDetail = {
        id: String(detail.id ?? detail._id),
        status: detail.status ?? null,
        createdAt:
          detail.createdAt ?? detail.created_at ?? new Date().toISOString(),
        fulfillment: (detail.fulfillment ?? detail.type ?? null) as any,
        note: detail.note ?? null,
        customerSnapshot:
          detail.customerSnapshot ?? detail.customer_snapshot ?? null,
        total: detail.total ?? detail.amount ?? detail.totals?.net ?? null,
        items: (detail.items ?? []).map((it: any) => ({
          productId: String(
            it.productId ?? it.product_id ?? it.product?.id ?? it.product?._id
          ),
          qty: num(it.qty),
          note: it.note ?? null,
          name: it.name ?? it.product?.name ?? null,
          unitPrice:
            it.unitPrice ?? it.unit_price ?? it.product?.salePrice ?? null,
        })),
      };

      setSelectedOrder(d);
    } catch (e: any) {
      setErr(String(e?.message || "No se pudo abrir el pedido"));
      setDrawerOpen(false);
      setSelectedOrderId(null);
      setSelectedOrder(null);
    } finally {
      setDrawerLoading(false);
    }
  }

  async function checkoutFromSelectedOrder(payload: {
    concept: string;
    note: string | null;
    payments: PosPaymentDraft[];
  }) {
    if (!selectedOrder) return;

    setBusy(true);
    setErr(null);

    try {
      const res = await apiFetchAuthed<CheckoutResult>(
        getAccessToken,
        "/pos/checkout",
        {
          method: "POST",
          body: JSON.stringify({
            dateKey: todayKey,
            fulfillment: selectedOrder.fulfillment ?? "TAKEAWAY",
            customerId: null,
            customerSnapshot: selectedOrder.customerSnapshot ?? null,
            note: payload.note ?? selectedOrder.note ?? null,
            items: selectedOrder.items.map((it) => ({
              productId: it.productId,
              qty: num(it.qty),
              note: it.note ?? null,
            })),
            payments: payload.payments,
            concept: payload.concept,
            categoryId: null,
          }),
        }
      );

      setOk(
        `Cobrado ✔ (Sale: ${String(res?.sale?.id ?? res?.sale?._id ?? "OK")})`
      );
      setTimeout(() => setOk(null), 1500);

      setPayOpen(false);
      setDrawerOpen(false);
      setSelectedOrderId(null);
      setSelectedOrder(null);

      await loadOrdersToday();
    } catch (e: any) {
      setErr(String(e?.message || "Error cobrando pedido"));
      throw e;
    } finally {
      setBusy(false);
    }
  }

  async function refreshAll() {
    setBusy(true);
    try {
      await loadOrdersToday();
      setOk("Actualizado ✔");
      setTimeout(() => setOk(null), 1200);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    loadOrdersToday();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AdminProtected allow={["CASHIER", "MANAGER", "ADMIN"]}>
      <div className="space-y-6">
        {/* Header */}
        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
                Pedidos (Caja)
              </h1>
              <p className="mt-1 text-sm text-zinc-500">
                Solo pedidos de <b>hoy</b>: <b>{todayKey}</b>
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={refreshAll}
                loading={busy || loading}
              >
                <span className="inline-flex items-center gap-2">
                  <RefreshCcw className="h-4 w-4" />
                  Actualizar
                </span>
              </Button>
            </div>
          </div>

          {(err || ok) && (
            <div className="mt-4 grid gap-2">
              {err && <Notice tone="error">{err}</Notice>}
              {!err && ok && <Notice tone="ok">{ok}</Notice>}
            </div>
          )}

          {!canUse && (
            <div className="mt-4">
              <Notice tone="warn">
                Tu usuario no tiene roles para ver caja (CASHIER/MANAGER/ADMIN).
              </Notice>
            </div>
          )}

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <Field label="Buscar">
              <div className="flex gap-2">
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Nombre / teléfono / nota…"
                  disabled={!canUse || busy}
                />
                <Button
                  variant="secondary"
                  onClick={() => loadOrdersToday()}
                  disabled={!canUse || busy}
                >
                  <span className="inline-flex items-center gap-2">
                    <Search className="h-4 w-4" />
                    Buscar{" "}
                  </span>
                </Button>
              </div>
            </Field>

            <div className="md:col-span-2 text-xs text-zinc-500 flex items-center">
              Tip: tocá Ver para abrir el panel lateral con detalle y
              cobro.
            </div>
          </div>
        </div>

        {/* List */}
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <div className="border-b border-zinc-100 px-5 py-4">
            <h2 className="text-lg font-semibold text-zinc-900">
              Pedidos de hoy
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              Total: <b>{orders.length}</b>
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">
                    Fecha
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">
                    Cliente / Tipo
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">
                    Estado
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">
                    Total
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">
                    Acciones
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-zinc-100">
                {(loading || busy) && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-sm text-zinc-500">
                      Cargando…
                    </td>
                  </tr>
                )}

                {!loading && orders.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-10 text-sm text-zinc-500"
                    >
                      No hay pedidos hoy.
                    </td>
                  </tr>
                )}

                {!loading &&
                  orders.map((o) => {
                    const f = fulfillmentLabel(o.fulfillment ?? "TAKEAWAY");
                    const name = o.customerSnapshot?.name ?? "—";
                    const phone = o.customerSnapshot?.phone ?? null;

                    return (
                      <tr key={o.id} className="hover:bg-zinc-50">
                        <td className="px-4 py-3 text-sm text-zinc-600">
                          {new Date(o.createdAt).toLocaleString("es-AR")}
                          <div className="text-xs text-zinc-400">
                            ID: {o.id}
                          </div>
                        </td>

                        <td className="px-4 py-3 text-sm text-zinc-700">
                          <div className="flex items-center gap-2">
                            {f.icon}
                            <b className="text-zinc-900">{f.label}</b>
                          </div>
                          <div className="mt-1 text-xs text-zinc-500">
                            {name}
                            {phone ? ` · ${phone}` : ""}
                          </div>
                          {o.fulfillment === "DELIVERY" &&
                          o.customerSnapshot?.addressLine1 ? (
                            <div className="mt-1 text-xs text-zinc-500">
                              <MapPin className="inline h-3 w-3" />{" "}
                              {o.customerSnapshot.addressLine1}
                            </div>
                          ) : null}
                        </td>

                        <td className="px-4 py-3 text-sm text-zinc-700">
                          <span className="inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold border-zinc-200 bg-zinc-50 text-zinc-700">
                            {o.status ?? "—"}
                          </span>
                          {o.note ? (
                            <div className="mt-1 text-xs text-zinc-500 truncate max-w-90">
                              Nota: {o.note}
                            </div>
                          ) : null}
                        </td>

                        <td className="px-4 py-3 text-sm font-semibold text-zinc-900">
                          {o.total != null ? moneyARS(o.total) : "—"}
                        </td>

                        <td className="px-4 py-3 text-sm">
                          <div className="flex flex-wrap gap-2">
                            <Button
                              variant="secondary"
                              onClick={() => openDrawer(o.id)}
                              disabled={busy}
                            >
                              Ver
                            </Button>
                            <Button
                              onClick={async () => {
                                await openDrawer(o.id);
                                // si abre ok, ya podés tocar cobrar desde el panel
                              }}
                              disabled={busy}
                            >
                              Cobrar
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
            Hoy: <b>{todayKey}</b>
          </div>
        </div>

        {/* Drawer */}
        <OrderDrawer
          open={drawerOpen}
          onClose={() => {
            if (busy) return;
            setDrawerOpen(false);
            setSelectedOrderId(null);
            setSelectedOrder(null);
          }}
          busy={busy}
          loading={drawerLoading}
          order={selectedOrder}
          onPay={() => setPayOpen(true)}
        />

        {/* Pay modal */}
        <PayOrderModal
          open={payOpen}
          onClose={() => {
            if (busy) return;
            setPayOpen(false);
          }}
          busy={busy}
          order={selectedOrder}
          onConfirm={checkoutFromSelectedOrder}
        />
      </div>
    </AdminProtected>
  );
}
