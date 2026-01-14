"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { AdminProtected } from "@/components/AdminProtected";
import { useAuth } from "@/app/providers/AuthProvider";
import { apiFetchAuthed } from "@/lib/apiAuthed";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Field";
import {
  ClipboardList,
  RefreshCcw,
  Search,
  XCircle,
  BadgeCheck,
  SlidersHorizontal,
} from "lucide-react";

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
 * Page: Admin Orders (POS-aligned)
 * - Single fetch effect (no triple load)
 * - Paid map optimized (only when needed)
 * - POS-ish mobile cards (compact, totals highlighted)
 * - Chips for active filters (quick clear)
 * - Desktop: still table, but tighter & more POS-like
 * ========================================================================== */

const STATUS_TABS = [
  { key: "", label: "Todos" },
  { key: "DRAFT", label: "Borrador" },
  { key: "PENDING", label: "Pendientes" },
  { key: "ACCEPTED", label: "Aceptados" },
  { key: "REJECTED", label: "Rechazados" },
  { key: "CANCELLED", label: "Cancelados" },
];

function isoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}

/* =============================================================================
 * Minimal Drawer (no deps) - Bottom sheet on mobile
 * ========================================================================== */
function Drawer({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    setTimeout(() => panelRef.current?.focus(), 0);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-60">
      <button
        aria-label="Cerrar"
        className="absolute inset-0 bg-black/35"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        className="absolute bottom-0 left-0 right-0 max-h-[85vh] overflow-hidden rounded-t-3xl border-t border-zinc-200 bg-white shadow-2xl outline-none"
      >
        <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-10 rounded-full bg-zinc-200" />
            <h3 className="text-sm font-semibold text-zinc-900">
              {title || "Detalle"}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-900 hover:bg-zinc-50"
          >
            Cerrar
          </button>
        </div>
        <div className="overflow-auto p-4">{children}</div>
      </div>
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="animate-pulse rounded-2xl border border-zinc-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="h-4 w-40 rounded bg-zinc-100" />
          <div className="mt-2 h-3 w-64 rounded bg-zinc-100" />
          <div className="mt-3 flex gap-2">
            <div className="h-6 w-20 rounded-full bg-zinc-100" />
            <div className="h-6 w-24 rounded-full bg-zinc-100" />
            <div className="h-6 w-20 rounded-full bg-zinc-100" />
          </div>
        </div>
        <div className="h-8 w-24 rounded-xl bg-zinc-100" />
      </div>
    </div>
  );
}

function TopBar({
  title,
  subtitle,
  leftMeta,
  right,
}: {
  title: string;
  subtitle?: string;
  leftMeta?: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm md:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900 md:text-2xl">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>
          ) : null}
          {leftMeta ? <div className="mt-3">{leftMeta}</div> : null}
        </div>

        {right ? <div className="flex flex-wrap gap-2">{right}</div> : null}
      </div>
    </div>
  );
}

export default function AdminOrdersPage() {
  const { getAccessToken, user } = useAuth();
  const roles = (user?.roles ?? []).map((r: any) => String(r).toUpperCase());
  const canUse =
    roles.includes("ADMIN") ||
    roles.includes("MANAGER") ||
    roles.includes("CASHIER");

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

  // Drawer: order details
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  // Drawer: filters (mobile)
  const [filtersOpen, setFiltersOpen] = useState(false);

  const busyOrLoading = busy || loading;

  // ---- Paid map (optimized) ----
  async function loadSalesPaidMap(days = 14) {
    try {
      const to = new Date();
      const from = new Date();
      from.setDate(from.getDate() - days);

      const qs = new URLSearchParams();
      qs.set("limit", "500");
      qs.set("from", isoDate(from));
      qs.set("to", isoDate(to));

      const rows = await apiFetchAuthed<any[]>(
        getAccessToken,
        `/sales?${qs.toString()}`
      );

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
      setPaidMap({});
    }
  }

  // ---- Orders ----
  async function loadOrders() {
    setErr(null);
    setLoading(true);

    try {
      const qs = new URLSearchParams();
      if (status) qs.set("status", status);
      if (fulfillment) qs.set("fulfillment", fulfillment);
      if (q.trim()) qs.set("q", q.trim());
      qs.set("limit", String(limit || 50));

      const res = await apiFetchAuthed<any[]>(
        getAccessToken,
        `/orders?${qs.toString()}`
      );

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

      // paid map only if there are orders
      if (norm.length) loadSalesPaidMap(14).catch(() => {});
      else setPaidMap({});
    } catch (e: any) {
      const msg = String(e?.message || "Error cargando pedidos");
      setErr(looksForbidden(msg) ? "Sin permisos." : msg);
      setOrders([]);
      setPaidMap({});
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
      // loadOrders already triggers paidMap; but on manual refresh we ensure it:
      await loadSalesPaidMap(14);
      setOk("Actualizado ✔");
      setTimeout(() => setOk(null), 1200);
    } catch (e: any) {
      setErr(String(e?.message || "Error actualizando"));
    } finally {
      setBusy(false);
    }
  }

  // ---- SINGLE effect for all filters (debounced) ----
  const firstLoadRef = useRef(true);
  useEffect(() => {
    if (!canUse) return;

    if (firstLoadRef.current) {
      firstLoadRef.current = false;
      loadOrders().catch(() => {});
      return;
    }

    const t = setTimeout(() => loadOrders().catch(() => {}), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, fulfillment, limit, q, canUse]);

  // ---- Derived ----
  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const o of orders) {
      const k = String(o.status || "UNKNOWN").toUpperCase();
      map[k] = (map[k] || 0) + 1;
    }
    return map;
  }, [orders]);

  const activeTabLabel = useMemo(() => {
    const t = STATUS_TABS.find((x) => x.key === status);
    return t?.label || "Todos";
  }, [status]);

  const activeFiltersCount = useMemo(() => {
    let n = 0;
    if (status) n++;
    if (fulfillment) n++;
    if (q.trim()) n++;
    return n;
  }, [status, fulfillment, q]);

  const activeChips = useMemo(() => {
    const chips: { key: string; label: string; onClear: () => void }[] = [];
    if (status)
      chips.push({
        key: "status",
        label: `Estado: ${activeTabLabel}`,
        onClear: () => setStatus(""),
      });
    if (fulfillment) {
      const meta = fulfillmentMeta(fulfillment as any);
      chips.push({
        key: "fulfillment",
        label: `Tipo: ${meta?.label || fulfillment}`,
        onClear: () => setFulfillment(""),
      });
    }
    if (q.trim())
      chips.push({
        key: "q",
        label: `Buscar: ${q.trim()}`,
        onClear: () => setQ(""),
      });
    return chips;
  }, [status, fulfillment, q, activeTabLabel]);

  const totals = useMemo(() => {
    const total = orders.reduce((acc, o) => acc + (typeof o.total === "number" ? o.total : 0), 0);
    return { total };
  }, [orders]);

  // ---- Handlers ----
  function openOrder(id: string) {
    setSelectedOrderId(id);
    setDrawerOpen(true);
  }

  return (
    <AdminProtected>
      <div className="space-y-4 md:space-y-6">
        {/* Header (POS-aligned, compact) */}
        <TopBar
          title="Pedidos"
          subtitle="Abrí un pedido para ver / editar / cobrar (drawer)."
          leftMeta={
            <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-600">
              <span className="inline-flex items-center gap-2">
                <ClipboardList className="h-4 w-4" />
                Total: <b className="text-zinc-900">{orders.length}</b>
              </span>
              <span className="hidden text-zinc-300 md:inline">•</span>
              <span className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-500">
                Estado: <span className="text-zinc-800">{activeTabLabel}</span>
              </span>
              <span className="hidden text-zinc-300 md:inline">•</span>
              <span className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-500">
                Total $:{" "}
                <span className="text-emerald-700 font-extrabold">
                  {moneyARS(totals.total)}
                </span>
              </span>
            </div>
          }
          right={
            <>
              <Button
                variant="secondary"
                onClick={() => setFiltersOpen(true)}
                disabled={!canUse}
                className="md:hidden"
              >
                <SlidersHorizontal className="h-4 w-4" />
                Filtros
                {activeFiltersCount ? (
                  <span className="ml-2 rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] font-bold text-white">
                    {activeFiltersCount}
                  </span>
                ) : null}
              </Button>

              <Button
                variant="secondary"
                onClick={refresh}
                loading={busyOrLoading}
                disabled={!canUse}
              >
                <span className="inline-flex items-center gap-2">
                  <RefreshCcw className="h-4 w-4" />
                  Actualizar
                </span>
              </Button>

              <Button
                variant="secondary"
                onClick={() => {
                  setStatus("");
                  setFulfillment("");
                  setQ("");
                  setLimit(50);
                }}
                disabled={!canUse || busyOrLoading}
                className="hidden md:inline-flex"
              >
                <span className="inline-flex items-center gap-2">
                  <XCircle className="h-4 w-4" />
                  Limpiar
                </span>
              </Button>
            </>
          }
        />

        {(err || ok) && (
          <div className="grid gap-2">
            {err && <Notice tone="error">{err}</Notice>}
            {!err && ok && <Notice tone="ok">{ok}</Notice>}
          </div>
        )}

        {!canUse && (
          <Notice tone="warn">
            Tu usuario no tiene roles para gestionar pedidos (ADMIN/MANAGER/CASHIER).
          </Notice>
        )}

        {/* Tabs */}
        <div className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm md:p-6">
          <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
            <div className="flex w-max gap-2 md:flex-wrap md:w-auto">
              {STATUS_TABS.map((t) => {
                const active = status === t.key;
                const count =
                  t.key === ""
                    ? orders.length
                    : counts[String(t.key).toUpperCase()] || 0;

                return (
                  <button
                    key={t.key}
                    onClick={() => setStatus(t.key)}
                    disabled={!canUse}
                    className={cn(
                      "shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                      active
                        ? "border-zinc-900 bg-zinc-900 text-white"
                        : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
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
          </div>

          {/* Chips (quick clear) */}
          {activeChips.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {activeChips.map((c) => (
                <button
                  key={c.key}
                  onClick={c.onClear}
                  disabled={!canUse}
                  className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
                >
                  {c.label} <span className="ml-1 text-zinc-400">×</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="mt-3 text-xs text-zinc-500">
              Tip: usá los tabs y filtros para encontrar pedidos rápido.
            </div>
          )}

          {/* Desktop Filters (POS-like compact) */}
          <div className="mt-5 hidden gap-3 md:grid md:grid-cols-4">
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
                  placeholder="ID, nombre, tel, nota…"
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
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-xs font-semibold text-zinc-600">
                {busyOrLoading ? "Cargando…" : "Listo"}
              </div>
            </div>
          </div>
        </div>

        {/* LIST: Mobile cards (POS-ish) */}
        <div className="md:hidden space-y-3">
          {busyOrLoading && (
            <>
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </>
          )}

          {!busyOrLoading && orders.length === 0 && (
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600">
              No hay pedidos con estos filtros.
            </div>
          )}

          {!busyOrLoading &&
            orders.map((o) => {
              const meta = fulfillmentMeta(o.fulfillment);
              const customer =
                o.customerSnapshot?.name ||
                o.customerSnapshot?.phone ||
                (o.customerId ? `CustomerId: ${o.customerId}` : "—");

              const pm = paidMap[o.id];
              const payStatus = pm?.saleStatus ?? null;

              return (
                <button
                  key={o.id}
                  onClick={() => openOrder(o.id)}
                  className="w-full text-left"
                  disabled={!canUse}
                >
                  <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:bg-zinc-50 disabled:opacity-60">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[11px] font-semibold text-zinc-500">
                          {fmtDateTime(o.createdAt)}
                        </div>
                        <div className="mt-1 truncate text-sm font-extrabold text-zinc-900">
                          {customer}
                        </div>
                        {o.customerSnapshot?.addressLine1 ? (
                          <div className="mt-1 truncate text-xs text-zinc-500">
                            {o.customerSnapshot.addressLine1}
                          </div>
                        ) : null}
                      </div>

                      <div className="shrink-0 text-right">
                        <div className="text-base font-extrabold text-emerald-700">
                          {o.total != null ? moneyARS(o.total) : "—"}
                        </div>
                        <div className="mt-1 text-[11px] text-zinc-500">
                          Items:{" "}
                          <b className="text-zinc-700">{o.itemsCount ?? "—"}</b>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                          statusPillClass(o.status)
                        )}
                      >
                        {String(o.status)}
                      </span>

                      <span
                        className={cn(
                          "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                          salePillClass(payStatus)
                        )}
                        title={
                          pm?.paidAt
                            ? `Venta: ${pm.saleStatus} · Pagado: ${fmtDateTime(pm.paidAt)} · SaleId: ${pm.saleId}`
                            : pm?.saleStatus
                            ? `Venta: ${pm.saleStatus} · SaleId: ${pm.saleId}`
                            : "Sin venta"
                        }
                      >
                        <BadgeCheck className="h-4 w-4" />
                        {payStatus ? String(payStatus) : "SIN VENTA"}
                      </span>

                      <span className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-zinc-700">
                        {meta.icon}
                        {meta.label}
                      </span>
                    </div>

                    {o.note ? (
                      <div className="mt-3 line-clamp-2 text-[11px] text-zinc-600">
                        {o.note}
                      </div>
                    ) : null}
                  </div>
                </button>
              );
            })}

          <div className="pb-16 text-xs text-zinc-500">
            Tip: abrí un pedido para cobrarlo desde el panel “Cobro”.
          </div>
        </div>

        {/* LIST: Desktop table (tight, POS-like) */}
        <div className="hidden md:block">
          <Card>
            <CardHeader
              title="Listado"
              subtitle="Click en un pedido para ver / editar / cobrar"
            />
            <CardBody>
              <div className="overflow-x-auto rounded-2xl border border-zinc-200">
                <table className="min-w-full">
                  <thead className="bg-zinc-50">
                    <tr>
                      <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-zinc-500">
                        Fecha
                      </th>
                      <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-zinc-500">
                        Estado
                      </th>
                      <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-zinc-500">
                        Pago
                      </th>
                      <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-zinc-500">
                        Tipo
                      </th>
                      <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-zinc-500">
                        Cliente
                      </th>
                      <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-zinc-500">
                        Items
                      </th>
                      <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-zinc-500">
                        Total
                      </th>
                      <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-zinc-500">
                        Nota
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-zinc-100">
                    {busyOrLoading && (
                      <tr>
                        <td colSpan={8} className="px-4 py-10 text-sm text-zinc-500">
                          Cargando…
                        </td>
                      </tr>
                    )}

                    {!busyOrLoading && orders.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-4 py-10 text-sm text-zinc-500">
                          No hay pedidos con estos filtros.
                        </td>
                      </tr>
                    )}

                    {!busyOrLoading &&
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
                            className="cursor-pointer hover:bg-zinc-50"
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") openOrder(o.id);
                            }}
                            onClick={() => openOrder(o.id)}
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
                                title={
                                  pm?.paidAt
                                    ? `Venta: ${pm.saleStatus} · Pagado: ${fmtDateTime(pm.paidAt)} · SaleId: ${pm.saleId}`
                                    : pm?.saleStatus
                                    ? `Venta: ${pm.saleStatus} · SaleId: ${pm.saleId}`
                                    : "Sin venta"
                                }
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
                                  <div className="truncate text-xs text-zinc-500">
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
                              <div className="max-w-85 truncate">{o.note || "—"}</div>
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
        </div>

        {/* Sticky bottom bar (mobile) */}
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 bg-white/95 p-3 backdrop-blur md:hidden">
          <div className="mx-auto flex max-w-3xl items-center gap-2">
            <button
              className="flex-1 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-900 shadow-sm hover:bg-zinc-50 disabled:opacity-60"
              disabled={!canUse}
              onClick={() => setFiltersOpen(true)}
            >
              <span className="inline-flex items-center justify-center gap-2">
                <SlidersHorizontal className="h-4 w-4" />
                Filtros
                {activeFiltersCount ? (
                  <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] font-bold text-white">
                    {activeFiltersCount}
                  </span>
                ) : null}
              </span>
            </button>

            <button
              className="flex-1 rounded-2xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-zinc-800 disabled:opacity-60"
              disabled={!canUse || busyOrLoading}
              onClick={refresh}
            >
              <span className="inline-flex items-center justify-center gap-2">
                <RefreshCcw className="h-4 w-4" />
                Actualizar
              </span>
            </button>
          </div>
        </div>

        {/* Filters Drawer (mobile) */}
        <Drawer open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filtros">
          <div className="grid gap-3">
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
                  placeholder="ID, nombre, tel, nota…"
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

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-900 hover:bg-zinc-50 disabled:opacity-60"
                disabled={!canUse || busyOrLoading}
                onClick={() => {
                  setStatus("");
                  setFulfillment("");
                  setQ("");
                  setLimit(50);
                  setFiltersOpen(false);
                }}
              >
                <span className="inline-flex items-center justify-center gap-2">
                  <XCircle className="h-4 w-4" />
                  Limpiar
                </span>
              </button>

              <button
                className="rounded-2xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60"
                disabled={!canUse}
                onClick={() => setFiltersOpen(false)}
              >
                Aplicar
              </button>
            </div>

            <div className="pt-2 text-xs text-zinc-500">
              Tip: los tabs de estado ya filtran arriba (deslizá horizontal si no entran).
            </div>
          </div>
        </Drawer>

        {/* Order Drawer */}
        <OrderDrawer
          open={drawerOpen}
          orderId={selectedOrderId}
          paidMeta={selectedOrderId ? paidMap[selectedOrderId] ?? null : null}
          onClose={() => setDrawerOpen(false)}
          onChanged={async () => {
            await loadOrders();
            await loadSalesPaidMap(14);
          }}
        />
      </div>
    </AdminProtected>
  );
}
