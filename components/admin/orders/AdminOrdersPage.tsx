"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { AdminProtected } from "@/components/AdminProtected";
import { useAuth } from "@/app/providers/AuthProvider";
import { apiFetchAuthed } from "@/lib/apiAuthed";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Field";
import { ClipboardList, RefreshCcw, Search, XCircle, BadgeCheck } from "lucide-react";

import { Notice } from "./Notice";
import { OrderDrawer } from "./OrderDrawer";

import {
  cn,
  fmtDateTime,
  fulfillmentMeta,
  looksForbidden,
  moneyARS,
  num,
  salePillClass,
  statusPillClass,
} from "@/lib/adminOrders/helpers";

import type { OrderPaidMeta, OrderRow } from "@/lib/adminOrders/types";

/* =============================================================================
 * Page: Admin Orders
 * ========================================================================== */

const STATUS_TABS = [
  { key: "", label: "Todos" },
  { key: "DRAFT", label: "Borrador" },
  { key: "ACCEPTED", label: "Aceptados" },
  { key: "REJECTED", label: "Rechazados" },
  { key: "CANCELLED", label: "Cancelados" },
  { key: "DELIVERED", label: "Entregados" },
];

export default function AdminOrdersPage() {
  const { getAccessToken, user } = useAuth();
  const roles = (user?.roles ?? []).map((r: any) => String(r).toUpperCase());
  const canUse =
    roles.includes("ADMIN") || roles.includes("MANAGER") || roles.includes("CASHIER");

  const [status, setStatus] = useState<string>("");
  const [fulfillment, setFulfillment] = useState<string>("");
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(50);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [paidMap, setPaidMap] = useState<Record<string, OrderPaidMeta>>({});

  // Drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  async function loadSalesPaidMap() {
    // Traemos ventas recientes y armamos mapa orderId -> sale
    // (si necesitás “por día”, lo ajustamos con from/to)
    try {
      const rows = await apiFetchAuthed<any[]>(getAccessToken, `/sales?limit=200`);

      const map: Record<string, OrderPaidMeta> = {};
      for (const s of rows ?? []) {
        const orderId = s?.orderId
          ? String(s.orderId)
          : s?.order_id
          ? String(s.order_id)
          : null;
        if (!orderId) continue;

        const saleId = String(s?.id ?? s?._id ?? "");
        const saleStatus = String(s?.status ?? "");
        const paidAt = s?.paidAt ?? s?.paid_at ?? null;

        // si hay varias, preferimos PAID
        const prev = map[orderId];
        if (!prev) {
          map[orderId] = { saleId, saleStatus, paidAt };
        } else {
          const prevPaid = String(prev.saleStatus ?? "").toUpperCase() === "PAID";
          const nowPaid = String(saleStatus ?? "").toUpperCase() === "PAID";
          if (!prevPaid && nowPaid) map[orderId] = { saleId, saleStatus, paidAt };
        }
      }
      setPaidMap(map);
    } catch {
      // si falla, no rompemos la pantalla
      setPaidMap({});
    }
  }

  async function loadOrders() {
    setErr(null);
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (status) qs.set("status", status);
      if (fulfillment) qs.set("fulfillment", fulfillment);
      if (q.trim()) qs.set("q", q.trim());
      qs.set("limit", String(limit || 50));

      const res = await apiFetchAuthed<any[]>(getAccessToken, `/orders?${qs.toString()}`);

      const norm: OrderRow[] = (res ?? []).map((o: any) => ({
        id: String(o.id ?? o._id),
        status: String(o.status ?? "UNKNOWN"),
        source: o.source,
        fulfillment: o.fulfillment,
        customerId: o.customerId ? String(o.customerId) : null,
        customerSnapshot: o.customerSnapshot ?? o.customer_snapshot ?? null,
        note: o.note ?? null,
        itemsCount:
          typeof o.itemsCount === "number"
            ? o.itemsCount
            : Array.isArray(o.items)
            ? o.items.length
            : undefined,
        total: o.total != null ? num(o.total) : undefined,
        createdAt: o.createdAt ?? o.created_at,
        updatedAt: o.updatedAt ?? o.updated_at,
      }));

      setOrders(norm);

      // refrescamos paidMap en paralelo (no bloquea UI)
      loadSalesPaidMap().catch(() => {});
    } catch (e: any) {
      const msg = String(e?.message || "Error cargando pedidos");
      setErr(looksForbidden(msg) ? "Sin permisos." : msg);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }

  async function refresh() {
    setBusy(true);
    setOk(null);
    setErr(null);
    try {
      await loadOrders();
      setOk("Actualizado ✔");
      setTimeout(() => setOk(null), 1200);
    } catch (e: any) {
      setErr(String(e?.message || "Error actualizando"));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    loadOrders().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadOrders().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, fulfillment, limit]);

  // búsqueda con debounce
  const dqRef = useRef<any>(null);
  useEffect(() => {
    if (dqRef.current) clearTimeout(dqRef.current);
    dqRef.current = setTimeout(() => loadOrders().catch(() => {}), 300);
    return () => dqRef.current && clearTimeout(dqRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const o of orders) {
      const k = String(o.status || "UNKNOWN").toUpperCase();
      map[k] = (map[k] || 0) + 1;
    }
    return map;
  }, [orders]);

  return (
    <AdminProtected>
      <div className="space-y-6">
        {/* Header */}
        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
                Pedidos
              </h1>
              <p className="mt-1 text-sm text-zinc-500">
                Ver, aceptar/rechazar/cancelar, editar y cobrar desde el drawer.
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-zinc-600">
                <span className="inline-flex items-center gap-2">
                  <ClipboardList className="h-4 w-4" />
                  Total: <b>{orders.length}</b>
                </span>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="secondary" onClick={refresh} loading={busy || loading}>
                <RefreshCcw className="h-4 w-4" />
                Actualizar
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
                Tu usuario no tiene roles para gestionar pedidos (ADMIN/MANAGER/CASHIER).
              </Notice>
            </div>
          )}

          {/* Tabs */}
          <div className="mt-5 flex flex-wrap gap-2">
            {STATUS_TABS.map((t) => {
              const active = status === t.key;
              const count =
                t.key === "" ? orders.length : counts[String(t.key).toUpperCase()] || 0;

              return (
                <button
                  key={t.key}
                  onClick={() => setStatus(t.key)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-semibold",
                    active
                      ? "border-zinc-900 bg-zinc-900 text-white"
                      : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                  )}
                >
                  {t.label}{" "}
                  <span className={cn(active ? "text-white/80" : "text-zinc-400")}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Filters */}
          <div className="mt-5 grid gap-3 md:grid-cols-4">
            <Field label="Fulfillment">
              <Select
                value={fulfillment}
                onChange={(e) => setFulfillment(e.target.value)}
                disabled={!canUse}
              >
                <option value="">— Todos —</option>
                <option value="DINE_IN">Salón</option>
                <option value="TAKEAWAY">Take-away</option>
                <option value="DELIVERY">Delivery</option>
              </Select>
            </Field>

            <Field label="Buscar">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <Input
                  className="pl-9"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Nombre, tel, nota…"
                  disabled={!canUse}
                />
              </div>
            </Field>

            <Field label="Límite">
              <Select
                value={String(limit)}
                onChange={(e) => setLimit(Number(e.target.value))}
                disabled={!canUse}
              >
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
                <option value="200">200</option>
              </Select>
            </Field>

            <div className="flex items-end justify-end">
              <Button
                variant="secondary"
                onClick={() => {
                  setStatus("");
                  setFulfillment("");
                  setQ("");
                  setLimit(50);
                }}
                disabled={!canUse || busy || loading}
              >
                <XCircle className="h-4 w-4" />
                Limpiar
              </Button>
            </div>
          </div>
        </div>

        {/* List */}
        <Card>
          <CardHeader title="Listado" subtitle="Click en un pedido para ver/editar/cobrar" />
          <CardBody>
            <div className="overflow-x-auto rounded-2xl border border-zinc-200">
              <table className="min-w-full">
                <thead className="bg-zinc-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">
                      Fecha
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">
                      Estado
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">
                      Pago
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">
                      Tipo
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">
                      Cliente
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">
                      Items
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">
                      Total
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">
                      Nota
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-zinc-100">
                  {(loading || busy) && (
                    <tr>
                      <td colSpan={8} className="px-4 py-10 text-sm text-zinc-500">
                        Cargando…
                      </td>
                    </tr>
                  )}

                  {!loading && !busy && orders.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-10 text-sm text-zinc-500">
                        No hay pedidos con estos filtros.
                      </td>
                    </tr>
                  )}

                  {!loading &&
                    !busy &&
                    orders.map((o) => {
                      const meta = fulfillmentMeta(o.fulfillment);
                      const customer =
                        o.customerSnapshot?.name ||
                        o.customerSnapshot?.phone ||
                        (o.customerId ? `CustomerId: ${o.customerId}` : "—");

                      const pm = paidMap[o.id];
                      const payStatus = pm?.saleStatus ?? null;

                      return (
                        <tr
                          key={o.id}
                          className="hover:bg-zinc-50 cursor-pointer"
                          onClick={() => {
                            setSelectedOrderId(o.id);
                            setDrawerOpen(true);
                          }}
                        >
                          <td className="px-4 py-3 text-sm text-zinc-600">
                            {fmtDateTime(o.createdAt)}
                          </td>

                          <td className="px-4 py-3 text-sm">
                            <span
                              className={cn(
                                "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold",
                                statusPillClass(o.status)
                              )}
                            >
                              {String(o.status)}
                            </span>
                          </td>

                          <td className="px-4 py-3 text-sm">
                            <span
                              className={cn(
                                "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-semibold",
                                salePillClass(payStatus)
                              )}
                              title={pm?.paidAt ? `Pagado: ${fmtDateTime(pm.paidAt)}` : ""}
                            >
                              <BadgeCheck className="h-4 w-4" />
                              {payStatus ? String(payStatus) : "SIN VENTA"}
                            </span>
                          </td>

                          <td className="px-4 py-3 text-sm text-zinc-700">
                            <span className="inline-flex items-center gap-2">
                              {meta.icon}
                              {meta.label}
                            </span>
                          </td>

                          <td className="px-4 py-3 text-sm text-zinc-700">
                            <div className="min-w-0">
                              <div className="truncate">{customer}</div>
                              {o.customerSnapshot?.addressLine1 ? (
                                <div className="text-xs text-zinc-500 truncate">
                                  {o.customerSnapshot.addressLine1}
                                </div>
                              ) : null}
                            </div>
                          </td>

                          <td className="px-4 py-3 text-sm text-zinc-700">
                            {o.itemsCount ?? "—"}
                          </td>

                          <td className="px-4 py-3 text-sm font-semibold text-zinc-900">
                            {o.total != null ? moneyARS(o.total) : "—"}
                          </td>

                          <td className="px-4 py-3 text-sm text-zinc-600">
                            <div className="max-w-[340px] truncate">{o.note || "—"}</div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>

            <div className="mt-3 text-xs text-zinc-500">
              Tip: si un pedido se paga en efectivo después, abrilo y cobralo desde el panel “Cobro”.
            </div>
          </CardBody>
        </Card>

        {/* Drawer */}
        <OrderDrawer
          open={drawerOpen}
          orderId={selectedOrderId}
          paidMeta={selectedOrderId ? paidMap[selectedOrderId] ?? null : null}
          onClose={() => setDrawerOpen(false)}
          onChanged={async () => {
            await loadOrders();
            await loadSalesPaidMap();
          }}
        />
      </div>
    </AdminProtected>
  );
}
