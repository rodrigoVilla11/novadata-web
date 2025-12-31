"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/app/providers/AuthProvider";
import { apiFetchAuthed } from "@/lib/apiAuthed";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Field";
import {
  Ban,
  BadgeCheck,
  Check,
  CheckCircle2,
  ClipboardList,
  MapPin,
  Phone,
  PlusCircle,
  Search,
  Trash2,
  User,
  XCircle,
} from "lucide-react";

import { CobroPanel } from "./CobroPanel";
import { Notice } from "./Notice";

import {
  cn,
  fmtDateTime,
  fulfillmentMeta,
  getUnitPrice,
  isValidNumberDraft,
  looksForbidden,
  moneyARS,
  num,
  salePillClass,
  statusPillClass,
} from "@/lib/adminOrders/helpers";

import type {
  CustomerSnapshot,
  Fulfillment,
  OrderDetail,
  OrderItem,
  OrderPaidMeta,
  Product,
} from "@/lib/adminOrders/types";

/* =============================================================================
 * Detail Drawer
 * ========================================================================== */

export function OrderDrawer({
  open,
  onClose,
  orderId,
  onChanged,
  paidMeta,
}: {
  open: boolean;
  onClose: () => void;
  orderId: string | null;
  onChanged: () => void;
  paidMeta?: OrderPaidMeta | null;
}) {
  const { getAccessToken, user } = useAuth();
  const roles = (user?.roles ?? []).map((r: any) => String(r).toUpperCase());
  const canManage =
    roles.includes("ADMIN") || roles.includes("MANAGER") || roles.includes("CASHIER");

  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [detail, setDetail] = useState<OrderDetail | null>(null);

  // Draft edits
  const [fulfillment, setFulfillment] = useState<Fulfillment>("TAKEAWAY");
  const [note, setNote] = useState("");
  const [snapshot, setSnapshot] = useState<CustomerSnapshot>({
    name: "",
    phone: "",
    addressLine1: "",
    addressLine2: "",
    notes: "",
  });
  const [items, setItems] = useState<OrderItem[]>([]);

  // Add product
  const [pq, setPq] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const debounceRef = useRef<any>(null);

  // Reject
  const [rejectReason, setRejectReason] = useState("");

  useEffect(() => {
    if (!open || !orderId) return;

    (async () => {
      setErr(null);
      setOk(null);
      setLoading(true);
      try {
        const res = await apiFetchAuthed<any>(getAccessToken, `/orders/${orderId}`);
        const d: OrderDetail = {
          id: String(res?.id ?? res?._id ?? orderId),
          status: String(res?.status ?? "UNKNOWN"),
          source: res?.source,
          fulfillment: res?.fulfillment,
          customerId: res?.customerId ? String(res.customerId) : null,
          customerSnapshot: res?.customerSnapshot ?? res?.customer_snapshot ?? null,
          note: res?.note ?? null,
          items: (res?.items ?? []).map((it: any) => ({
            productId: String(it.productId ?? it.product_id ?? it.product?.id ?? it.product?._id),
            qty: num(it.qty),
            note: it.note ?? null,
            name: it.name ?? it.product?.name,
            unitPrice: it.unitPrice != null ? num(it.unitPrice) : undefined,
            lineTotal: it.lineTotal != null ? num(it.lineTotal) : undefined,
          })),
          createdAt: res?.createdAt ?? res?.created_at,
          updatedAt: res?.updatedAt ?? res?.updated_at,
          rejectedReason:
            res?.rejectedReason ?? res?.rejectReason ?? res?.rejected_reason ?? null,
          itemsCount: Array.isArray(res?.items) ? res.items.length : undefined,
          total: res?.total != null ? num(res.total) : undefined,
        };

        setDetail(d);

        const f = String(d.fulfillment || "TAKEAWAY").toUpperCase() as Fulfillment;
        setFulfillment(
          (["DINE_IN", "TAKEAWAY", "DELIVERY"].includes(f) ? f : "TAKEAWAY") as Fulfillment
        );
        setNote(String(d.note ?? ""));
        setSnapshot({
          name: d.customerSnapshot?.name ?? "",
          phone: d.customerSnapshot?.phone ?? "",
          addressLine1: d.customerSnapshot?.addressLine1 ?? "",
          addressLine2: d.customerSnapshot?.addressLine2 ?? "",
          notes: d.customerSnapshot?.notes ?? "",
        });
        setItems(d.items ?? []);
        setRejectReason("");
      } catch (e: any) {
        const msg = String(e?.message || "Error cargando pedido");
        setErr(looksForbidden(msg) ? "Sin permisos." : msg);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, orderId]);

  async function searchProducts(query: string) {
    setLoadingProducts(true);
    try {
      const qs = new URLSearchParams();
      qs.set("onlyActive", "true");
      qs.set("sellable", "true");
      if (query.trim()) qs.set("q", query.trim());
      const rows = await apiFetchAuthed<any[]>(getAccessToken, `/products?${qs.toString()}`);
      setProducts(
        (rows ?? []).map((p: any) => ({
          id: String(p.id ?? p._id),
          name: p.name ?? "",
          salePrice: p.salePrice ?? null,
          computed: p.computed ?? null,
          isActive: p.isActive,
          sellable: p.sellable,
        }))
      );
    } finally {
      setLoadingProducts(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      searchProducts(pq).catch(() => {});
    }, 250);
    return () => debounceRef.current && clearTimeout(debounceRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pq, open]);

  const subtotal = useMemo(() => {
    return items.reduce((acc, it) => {
      if (it.lineTotal != null) return acc + num(it.lineTotal);
      if (it.unitPrice != null) return acc + num(it.unitPrice) * num(it.qty);
      return acc;
    }, 0);
  }, [items]);

  const deliveryNeedsData = useMemo(() => {
    if (fulfillment !== "DELIVERY") return false;
    const nameOk = !!String(snapshot.name ?? "").trim();
    const addrOk = !!String(snapshot.addressLine1 ?? "").trim();
    return !(nameOk && addrOk);
  }, [fulfillment, snapshot]);

  async function patchItems(nextItems: OrderItem[]) {
    if (!orderId) return;
    return apiFetchAuthed(getAccessToken, `/orders/${orderId}/items`, {
      method: "PATCH",
      body: JSON.stringify({
        items: nextItems.map((it) => ({
          productId: it.productId,
          qty: num(it.qty),
          note: it.note ?? null,
        })),
      }),
    });
  }

  async function patchNote(nextNote: string) {
    if (!orderId) return;
    return apiFetchAuthed(getAccessToken, `/orders/${orderId}/note`, {
      method: "PATCH",
      body: JSON.stringify({ note: nextNote?.trim() ? nextNote.trim() : null }),
    });
  }

  async function patchFulfillment(nextFulfillment: Fulfillment) {
    if (!orderId) return;
    return apiFetchAuthed(getAccessToken, `/orders/${orderId}/fulfillment`, {
      method: "PATCH",
      body: JSON.stringify({ fulfillment: nextFulfillment }),
    });
  }

  async function patchSnapshot(nextSnapshot: CustomerSnapshot) {
    if (!orderId) return;
    const payload: CustomerSnapshot =
      nextSnapshot == null
        ? {}
        : {
            name: String(nextSnapshot.name ?? "").trim() || null,
            phone: String(nextSnapshot.phone ?? "").trim() || null,
            addressLine1: String(nextSnapshot.addressLine1 ?? "").trim() || null,
            addressLine2: String(nextSnapshot.addressLine2 ?? "").trim() || null,
            notes: String(nextSnapshot.notes ?? "").trim() || null,
          };

    return apiFetchAuthed(getAccessToken, `/orders/${orderId}/customer-snapshot`, {
      method: "PATCH",
      body: JSON.stringify({ customerSnapshot: payload }),
    });
  }

  async function acceptOrder() {
    if (!orderId) return;
    return apiFetchAuthed(getAccessToken, `/orders/${orderId}/accept`, { method: "POST" });
  }

  async function rejectOrder(reason?: string) {
    if (!orderId) return;
    return apiFetchAuthed(getAccessToken, `/orders/${orderId}/reject`, {
      method: "POST",
      body: JSON.stringify({ reason: reason?.trim() ? reason.trim() : null }),
    });
  }

  async function cancelOrder() {
    if (!orderId) return;
    return apiFetchAuthed(getAccessToken, `/orders/${orderId}/cancel`, { method: "POST" });
  }

  function addItemFromProduct(p: Product) {
    setItems((prev) => {
      const ix = prev.findIndex((x) => x.productId === p.id);
      if (ix >= 0) {
        const copy = [...prev];
        copy[ix] = { ...copy[ix], qty: num(copy[ix].qty) + 1 };
        return copy;
      }
      return [
        ...prev,
        {
          productId: p.id,
          qty: 1,
          note: null,
          name: p.name,
          unitPrice: getUnitPrice(p),
          lineTotal: undefined,
        },
      ];
    });
  }

  function setItemQty(productId: string, draft: string) {
    if (!isValidNumberDraft(draft)) return;
    const q = draft === "" ? 0 : Math.floor(Number(draft));
    setItems((prev) =>
      prev
        .map((it) => (it.productId === productId ? { ...it, qty: Math.max(0, q) } : it))
        .filter((it) => num(it.qty) > 0)
    );
  }

  function setItemNote(productId: string, noteVal: string) {
    setItems((prev) =>
      prev.map((it) =>
        it.productId === productId
          ? { ...it, note: noteVal?.trim() ? noteVal : null }
          : it
      )
    );
  }

  function removeItem(productId: string) {
    setItems((prev) => prev.filter((it) => it.productId !== productId));
  }

  async function saveAll() {
    if (!orderId) return;
    setErr(null);
    setOk(null);

    if (deliveryNeedsData) {
      setErr("Delivery: completá Nombre y Dirección.");
      return;
    }

    setBusy(true);
    try {
      await patchFulfillment(fulfillment);
      await patchSnapshot(snapshot);
      await patchNote(note);
      await patchItems(items);

      setOk("Cambios guardados ✔");
      setTimeout(() => setOk(null), 1200);

      onChanged();
    } catch (e: any) {
      setErr(String(e?.message || "Error guardando"));
    } finally {
      setBusy(false);
    }
  }

  async function doAccept() {
    setErr(null);
    setOk(null);
    if (deliveryNeedsData) {
      setErr("Delivery: completá Nombre y Dirección antes de aceptar.");
      return;
    }
    setBusy(true);
    try {
      await saveAll();
      await acceptOrder();
      setOk("Pedido aceptado ✔");
      setTimeout(() => setOk(null), 1200);
      onChanged();
    } catch (e: any) {
      setErr(String(e?.message || "Error aceptando"));
    } finally {
      setBusy(false);
    }
  }

  async function doReject() {
    setErr(null);
    setOk(null);
    setBusy(true);
    try {
      await rejectOrder(rejectReason);
      setOk("Pedido rechazado ✔");
      setTimeout(() => setOk(null), 1200);
      onChanged();
    } catch (e: any) {
      setErr(String(e?.message || "Error rechazando"));
    } finally {
      setBusy(false);
    }
  }

  async function doCancel() {
    setErr(null);
    setOk(null);
    setBusy(true);
    try {
      await cancelOrder();
      setOk("Pedido cancelado ✔");
      setTimeout(() => setOk(null), 1200);
      onChanged();
    } catch (e: any) {
      setErr(String(e?.message || "Error cancelando"));
    } finally {
      setBusy(false);
    }
  }

  if (!open || !orderId) return null;

  const meta = fulfillmentMeta(detail?.fulfillment);
  const status = String(detail?.status ?? "");

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40">
      <div className="h-full w-full max-w-3xl bg-white shadow-2xl border-l border-zinc-200 flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-zinc-100 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-zinc-700" />
              <h3 className="text-lg font-semibold text-zinc-900 truncate">
                Pedido {orderId}
              </h3>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-zinc-600">
              <span
                className={cn(
                  "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold",
                  statusPillClass(status)
                )}
              >
                {status}
              </span>

              <span className="text-zinc-300">·</span>

              <span className="inline-flex items-center gap-2">
                {meta.icon} {meta.label}
              </span>

              <span className="text-zinc-300">·</span>

              <span
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-semibold",
                  salePillClass(paidMeta?.saleStatus ?? null)
                )}
                title={paidMeta?.paidAt ? `Pagado: ${fmtDateTime(paidMeta.paidAt)}` : ""}
              >
                <BadgeCheck className="h-4 w-4" />
                {paidMeta?.saleStatus ? String(paidMeta.saleStatus) : "SIN VENTA"}
              </span>

              <span className="text-zinc-300">·</span>

              <span className="text-xs text-zinc-500">
                Creado: {fmtDateTime(detail?.createdAt)}
              </span>
              <span className="text-zinc-300">·</span>
              <span className="text-xs text-zinc-500">
                Update: {fmtDateTime(detail?.updatedAt)}
              </span>
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose} disabled={busy}>
              Cerrar
            </Button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto px-5 py-4 space-y-4">
          {(err || ok) && (
            <div className="grid gap-2">
              {err && <Notice tone="error">{err}</Notice>}
              {!err && ok && <Notice tone="ok">{ok}</Notice>}
            </div>
          )}

          {loading ? (
            <div className="text-sm text-zinc-500">Cargando…</div>
          ) : !detail ? (
            <Notice tone="error">No se pudo cargar el pedido.</Notice>
          ) : (
            <>
              {!canManage && (
                <Notice tone="warn">
                  Tu usuario no tiene permisos para editar/accionar pedidos.
                </Notice>
              )}

              {/* Cobro */}
              <CobroPanel
                orderId={orderId}
                orderTotal={detail.total ?? subtotal}
                paidMeta={paidMeta ?? null}
                onPaid={onChanged}
              />

              {/* Fulfillment + Snapshot */}
              <Card>
                <CardHeader
                  title="Datos del pedido"
                  subtitle="Fulfillment + snapshot del cliente"
                />
                <CardBody>
                  <div className="grid gap-4 lg:grid-cols-3">
                    <div className="lg:col-span-1">
                      <Field label="Fulfillment">
                        <Select
                          value={fulfillment}
                          onChange={(e) => setFulfillment(e.target.value as Fulfillment)}
                          disabled={!canManage || busy}
                        >
                          <option value="DINE_IN">Salón</option>
                          <option value="TAKEAWAY">Take-away</option>
                          <option value="DELIVERY">Delivery</option>
                        </Select>
                      </Field>

                      {fulfillment === "DELIVERY" && (
                        <div className="mt-2 text-xs">
                          <div
                            className={cn(
                              "rounded-xl border px-3 py-2",
                              deliveryNeedsData
                                ? "border-rose-200 bg-rose-50 text-rose-700"
                                : "border-emerald-200 bg-emerald-50 text-emerald-700"
                            )}
                          >
                            {deliveryNeedsData
                              ? "Falta Nombre/Dirección para Delivery."
                              : "Delivery listo ✔"}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="lg:col-span-2">
                      <div className="grid gap-3 md:grid-cols-2">
                        <Field label="Nombre">
                          <div className="relative">
                            <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                            <Input
                              className="pl-9"
                              value={String(snapshot.name ?? "")}
                              onChange={(e) =>
                                setSnapshot((p) => ({ ...p, name: e.target.value }))
                              }
                              placeholder="Ej: Rodrigo"
                              disabled={!canManage || busy}
                            />
                          </div>
                        </Field>

                        <Field label="Teléfono">
                          <div className="relative">
                            <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                            <Input
                              className="pl-9"
                              value={String(snapshot.phone ?? "")}
                              onChange={(e) =>
                                setSnapshot((p) => ({ ...p, phone: e.target.value }))
                              }
                              placeholder="Ej: 351..."
                              disabled={!canManage || busy}
                            />
                          </div>
                        </Field>
                      </div>

                      {fulfillment === "DELIVERY" && (
                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                          <Field label="Dirección">
                            <div className="relative">
                              <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                              <Input
                                className={cn(
                                  "pl-9",
                                  deliveryNeedsData && "ring-1 ring-rose-200"
                                )}
                                value={String(snapshot.addressLine1 ?? "")}
                                onChange={(e) =>
                                  setSnapshot((p) => ({
                                    ...p,
                                    addressLine1: e.target.value,
                                  }))
                                }
                                placeholder="Calle y número"
                                disabled={!canManage || busy}
                              />
                            </div>
                          </Field>

                          <Field label="Piso / Depto / Referencia">
                            <Input
                              value={String(snapshot.addressLine2 ?? "")}
                              onChange={(e) =>
                                setSnapshot((p) => ({
                                  ...p,
                                  addressLine2: e.target.value,
                                }))
                              }
                              placeholder="Opcional"
                              disabled={!canManage || busy}
                            />
                          </Field>

                          <div className="md:col-span-2">
                            <Field label="Notas (delivery)">
                              <Input
                                value={String(snapshot.notes ?? "")}
                                onChange={(e) =>
                                  setSnapshot((p) => ({ ...p, notes: e.target.value }))
                                }
                                placeholder="Ej: timbre roto / dejar en portería…"
                                disabled={!canManage || busy}
                              />
                            </Field>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </CardBody>
              </Card>

              {/* Note */}
              <Card>
                <CardHeader title="Nota del pedido" subtitle="Observaciones generales" />
                <CardBody>
                  <Field label="Nota">
                    <Input
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Ej: sin wasabi / llamar al llegar…"
                      disabled={!canManage || busy}
                    />
                  </Field>
                </CardBody>
              </Card>

              {/* Items */}
              <Card>
                <CardHeader title="Items" subtitle="Editar cantidades/notas y agregar productos" />
                <CardBody>
                  {/* Add product */}
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Field label="Buscar producto para agregar">
                        <Input
                          value={pq}
                          onChange={(e) => setPq(e.target.value)}
                          placeholder="Ej: sushi burger, combo, bebida…"
                          disabled={!canManage || busy}
                        />
                      </Field>
                    </div>
                    <div className="mt-6">
                      <Button
                        variant="secondary"
                        onClick={() => searchProducts(pq)}
                        disabled={!canManage || busy}
                      >
                        <Search className="h-4 w-4" />
                        Buscar
                      </Button>
                    </div>
                  </div>

                  {loadingProducts ? (
                    <div className="mt-3 text-sm text-zinc-500">Buscando…</div>
                  ) : products.length ? (
                    <div className="mt-3 grid gap-2">
                      {products.slice(0, 8).map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white px-3 py-2"
                        >
                          <div className="min-w-0">
                            <div className="font-semibold text-zinc-900 truncate">{p.name}</div>
                            <div className="text-xs text-zinc-500">
                              Precio: <b>{moneyARS(getUnitPrice(p))}</b>
                            </div>
                          </div>

                          <Button
                            onClick={() => addItemFromProduct(p)}
                            disabled={!canManage || busy}
                            title="Agregar"
                          >
                            <PlusCircle className="h-4 w-4" />
                            Agregar
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  <div className="mt-4 space-y-2">
                    {items.length === 0 ? (
                      <div className="text-sm text-zinc-500">Este pedido no tiene items.</div>
                    ) : (
                      items.map((it) => (
                        <div
                          key={it.productId}
                          className="rounded-2xl border border-zinc-200 bg-white p-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="font-semibold text-zinc-900 truncate">
                                {it.name ?? it.productId}
                              </div>
                              <div className="text-xs text-zinc-500">
                                ProductId: <span className="font-mono">{it.productId}</span>
                                {it.unitPrice != null ? (
                                  <>
                                    {" "}
                                    · Unit: <b>{moneyARS(it.unitPrice)}</b>
                                  </>
                                ) : null}
                                {it.lineTotal != null ? (
                                  <>
                                    {" "}
                                    · Línea: <b>{moneyARS(it.lineTotal)}</b>
                                  </>
                                ) : null}
                              </div>
                            </div>

                            <Button
                              variant="danger"
                              onClick={() => removeItem(it.productId)}
                              disabled={!canManage || busy}
                              title="Eliminar item"
                            >
                              <Trash2 className="h-4 w-4" />
                              Quitar
                            </Button>
                          </div>

                          <div className="mt-3 grid gap-3 md:grid-cols-3">
                            <Field label="Cantidad">
                              <Input
                                value={String(it.qty ?? 0)}
                                onChange={(e) => setItemQty(it.productId, e.target.value)}
                                disabled={!canManage || busy}
                              />
                            </Field>

                            <Field label="Nota (item)">
                              <Input
                                value={it.note ?? ""}
                                onChange={(e) => setItemNote(it.productId, e.target.value)}
                                placeholder="Opcional"
                                disabled={!canManage || busy}
                              />
                            </Field>

                            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
                              <div className="text-xs text-zinc-500">Estimado</div>
                              <div className="text-lg font-semibold text-zinc-900">
                                {it.lineTotal != null
                                  ? moneyARS(it.lineTotal)
                                  : it.unitPrice != null
                                  ? moneyARS(num(it.unitPrice) * num(it.qty))
                                  : "—"}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-2">
                    <div className="text-sm text-zinc-600">
                      Items: <b className="text-zinc-900">{items.length}</b>
                      <span className="text-zinc-300"> · </span>
                      Estimado: <b className="text-zinc-900">{moneyARS(subtotal)}</b>
                    </div>

                    <Button
                      variant="secondary"
                      onClick={saveAll}
                      disabled={!canManage || busy}
                      loading={busy}
                    >
                      <Check className="h-4 w-4" />
                      Guardar cambios
                    </Button>
                  </div>
                </CardBody>
              </Card>

              {/* Actions */}
              <Card>
                <CardHeader title="Acciones" subtitle="Aceptar / Rechazar / Cancelar" />
                <CardBody>
                  {detail.rejectedReason ? (
                    <div className="mb-3 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                      Rechazo: {detail.rejectedReason}
                    </div>
                  ) : null}

                  <div className="grid gap-3 md:grid-cols-3">
                    <Button onClick={doAccept} disabled={!canManage || busy} loading={busy}>
                      <CheckCircle2 className="h-4 w-4" />
                      Aceptar
                    </Button>

                    <Button
                      variant="danger"
                      onClick={doCancel}
                      disabled={!canManage || busy}
                      loading={busy}
                    >
                      <Ban className="h-4 w-4" />
                      Cancelar
                    </Button>

                    <div className="rounded-2xl border border-zinc-200 bg-white p-3">
                      <div className="text-xs font-semibold text-zinc-700">Rechazar</div>
                      <div className="mt-2">
                        <Input
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          placeholder="Motivo (opcional)"
                          disabled={!canManage || busy}
                        />
                      </div>
                      <div className="mt-2">
                        <Button
                          variant="danger"
                          onClick={doReject}
                          disabled={!canManage || busy}
                          loading={busy}
                          className="w-full"
                        >
                          <XCircle className="h-4 w-4" />
                          Rechazar
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 text-xs text-zinc-500">
                    Tip: guardá cambios antes de aceptar (ya lo hace automático).
                  </div>
                </CardBody>
              </Card>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-zinc-100 flex items-center justify-between">
          <div className="text-xs text-zinc-500">
            {detail ? (
              <>
                Status: <b>{detail.status}</b>
                <span className="text-zinc-300"> · </span>
                Fulfillment: <b>{String(detail.fulfillment || "—")}</b>
              </>
            ) : (
              "—"
            )}
          </div>

          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose} disabled={busy}>
              Cerrar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
