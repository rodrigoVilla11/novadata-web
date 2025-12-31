"use client";

import React, { useMemo, useState } from "react";
import { useAuth } from "@/app/providers/AuthProvider";
import { apiFetchAuthed } from "@/lib/apiAuthed";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Field";
import {
  BadgeCheck,
  BadgeDollarSign,
  PlusCircle,
  Trash2,
} from "lucide-react";

import { Notice } from "./Notice";
import {
  cn,
  fmtDateTime,
  isValidNumberDraft,
  moneyARS,
  num,
  paymentIcon,
  salePillClass,
  todayKeyArgentina,
} from "@/lib/adminOrders/helpers";
import type { OrderPaidMeta, PaymentMethod, SalePayDraft } from "@/lib/adminOrders/types";

/* =============================================================================
 * Sales helpers (usa tus endpoints reales)
 * ========================================================================== */

async function createSaleFromOrder(getAccessToken: any, orderId: string) {
  // ✅ tu backend: POST /sales/from-order/:orderId
  const res = await apiFetchAuthed<any>(
    getAccessToken,
    `/sales/from-order/${orderId}`,
    { method: "POST" }
  );
  const id = String(res?.id ?? res?._id ?? res?.sale?.id ?? res?.sale?._id ?? "");
  if (!id) throw new Error("No se pudo crear la venta (saleId vacío)");
  return { id, raw: res };
}

async function paySale(
  getAccessToken: any,
  saleId: string,
  body: {
    dateKey: string;
    payments: Array<{ method: PaymentMethod; amount: number; note?: string | null }>;
    concept?: string;
    note?: string | null;
    categoryId?: string | null;
  }
) {
  // ✅ tu backend: POST /sales/:id/pay
  return apiFetchAuthed<any>(getAccessToken, `/sales/${saleId}/pay`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/**
 * Si ya existe Sale (por índice único orderId), el create puede fallar.
 * Como NO tenés GET /sales/by-order/:orderId, hacemos fallback:
 * - traemos /sales?limit=200 y buscamos por orderId.
 */
async function getSaleIdForOrderFallback(
  getAccessToken: any,
  orderId: string
): Promise<string | null> {
  const rows = await apiFetchAuthed<any[]>(getAccessToken, `/sales?limit=200`);
  const sale = (rows ?? []).find((s: any) => {
    const oid = String(s?.orderId ?? s?.order_id ?? "");
    return oid && oid === String(orderId);
  });
  const id = sale ? String(sale?.id ?? sale?._id ?? "") : null;
  return id || null;
}

/* =============================================================================
 * Cobro Panel (dentro del drawer)
 * ========================================================================== */

export function CobroPanel({
  orderId,
  orderTotal,
  paidMeta,
  onPaid,
}: {
  orderId: string;
  orderTotal?: number | null;
  paidMeta?: OrderPaidMeta | null;
  onPaid: () => void;
}) {
  const { getAccessToken, user } = useAuth();
  const roles = (user?.roles ?? []).map((r: any) => String(r).toUpperCase());
  const canPay =
    roles.includes("ADMIN") || roles.includes("MANAGER") || roles.includes("CASHIER");

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [dateKey, setDateKey] = useState(todayKeyArgentina());
  const [payments, setPayments] = useState<SalePayDraft[]>([
    { method: "CASH", amount: 0, note: null },
  ]);

  const totalPay = useMemo(
    () => payments.reduce((a, p) => a + num(p.amount), 0),
    [payments]
  );

  const targetTotal = num(orderTotal ?? 0);
  const diff = useMemo(() => totalPay - targetTotal, [totalPay, targetTotal]);

  const isPaid = String(paidMeta?.saleStatus ?? "").toUpperCase() === "PAID";
  const saleId = paidMeta?.saleId ?? null;

  function addPaymentLine() {
    setPayments((prev) => [...prev, { method: "TRANSFER", amount: 0, note: null }]);
  }
  function removePaymentLine(ix: number) {
    setPayments((prev) => prev.filter((_, i) => i !== ix));
  }
  function updatePayment(ix: number, patch: Partial<SalePayDraft>) {
    setPayments((prev) => {
      const copy = [...prev];
      copy[ix] = { ...copy[ix], ...patch };
      return copy;
    });
  }

  async function ensureSaleId(): Promise<string> {
    // si ya tenemos saleId por meta, úsalo
    if (saleId) return saleId;

    // intenta crear
    try {
      const created = await createSaleFromOrder(getAccessToken, orderId);
      return created.id;
    } catch (e: any) {
      // fallback: buscar por orderId (si era duplicado)
      const found = await getSaleIdForOrderFallback(getAccessToken, orderId);
      if (found) return found;
      throw new Error(String(e?.message || "No se pudo crear/encontrar la venta"));
    }
  }

  async function createDraftOnly() {
    setErr(null);
    setOk(null);
    if (!canPay) return;

    setBusy(true);
    try {
      const sid = await ensureSaleId();
      setOk(`Venta lista ✔ (Sale: ${sid})`);
      setTimeout(() => setOk(null), 1200);
      onPaid();
    } catch (e: any) {
      setErr(String(e?.message || "Error creando venta"));
    } finally {
      setBusy(false);
    }
  }

  async function doPay() {
    setErr(null);
    setOk(null);
    if (!canPay) return;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
      setErr("dateKey inválido (YYYY-MM-DD).");
      return;
    }

    const payloadPayments = payments
      .map((p) => ({
        method: p.method,
        amount: num(p.amount),
        note: p.note?.trim() ? p.note.trim() : null,
      }))
      .filter((p) => p.amount > 0);

    if (!payloadPayments.length) {
      setErr("Ingresá al menos un pago > 0.");
      return;
    }

    if (targetTotal > 0 && totalPay < targetTotal) {
      setErr("Los pagos no cubren el total del pedido.");
      return;
    }

    setBusy(true);
    try {
      const sid = await ensureSaleId();

      await paySale(getAccessToken, sid, {
        dateKey,
        payments: payloadPayments,
        concept: "VENTA POS",
        note: null,
        categoryId: null,
      });

      setOk("Cobrado ✔");
      setTimeout(() => setOk(null), 1200);
      onPaid();
    } catch (e: any) {
      setErr(String(e?.message || "Error cobrando"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Cobro"
        subtitle="Crear venta desde el pedido y registrar pagos (sin abrir el POS)"
      />
      <CardBody>
        {(err || ok) && (
          <div className="mb-3 grid gap-2">
            {err && <Notice tone="error">{err}</Notice>}
            {!err && ok && <Notice tone="ok">{ok}</Notice>}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm text-zinc-600">
            Total pedido: <b className="text-zinc-900">{moneyARS(targetTotal)}</b>
            <span className="text-zinc-300"> · </span>
            Pagos: <b className="text-zinc-900">{moneyARS(totalPay)}</b>
            <span className="text-zinc-300"> · </span>
            Dif:{" "}
            <b className={cn(diff >= 0 ? "text-emerald-700" : "text-rose-700")}>
              {moneyARS(diff)}
            </b>
          </div>

          <div className="flex items-center gap-2">
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
          </div>
        </div>

        {!canPay && (
          <div className="mt-3">
            <Notice tone="warn">
              Tu usuario no tiene permisos para cobrar (ADMIN/MANAGER/CASHIER).
            </Notice>
          </div>
        )}

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <Field label="Fecha de caja (dateKey)">
            <Input
              type="date"
              value={dateKey}
              onChange={(e) => setDateKey(e.target.value)}
              disabled={!canPay || busy}
            />
          </Field>

          <div className="md:col-span-2 flex items-end justify-end gap-2">
            <Button
              variant="secondary"
              onClick={createDraftOnly}
              disabled={!canPay || busy}
              loading={busy}
              title="Crea la venta desde el pedido (si no existe)"
            >
              <PlusCircle className="h-4 w-4" />
              Crear venta
            </Button>

            <Button
              onClick={doPay}
              disabled={!canPay || busy || isPaid}
              loading={busy}
              title={isPaid ? "Ya está pagado" : "Cobrar"}
            >
              <BadgeDollarSign className="h-4 w-4" />
              {isPaid ? "Pagado" : "Cobrar"}
            </Button>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {payments.map((p, ix) => (
            <div key={ix} className="rounded-2xl border border-zinc-200 bg-white p-3">
              <div className="grid gap-3 md:grid-cols-4">
                <Field label="Método">
                  <Select
                    value={p.method}
                    onChange={(e) =>
                      updatePayment(ix, { method: e.target.value as PaymentMethod })
                    }
                    disabled={!canPay || busy || isPaid}
                  >
                    <option value="CASH">Efectivo</option>
                    <option value="TRANSFER">Transferencia</option>
                    <option value="CARD">Tarjeta</option>
                  </Select>
                </Field>

                <Field label="Monto">
                  <Input
                    value={String(p.amount ?? 0)}
                    onChange={(e) => {
                      if (!isValidNumberDraft(e.target.value)) return;
                      updatePayment(ix, { amount: num(e.target.value) });
                    }}
                    disabled={!canPay || busy || isPaid}
                  />
                </Field>

                <Field label="Nota (opcional)">
                  <Input
                    value={p.note ?? ""}
                    onChange={(e) => updatePayment(ix, { note: e.target.value })}
                    disabled={!canPay || busy || isPaid}
                    placeholder="Ej: comprobante, últimos 4 dígitos…"
                  />
                </Field>

                <div className="flex items-end justify-end gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => removePaymentLine(ix)}
                    disabled={!canPay || busy || isPaid || payments.length <= 1}
                    title="Quitar línea"
                  >
                    <Trash2 className="h-4 w-4" />
                    Quitar
                  </Button>
                </div>
              </div>

              <div className="mt-2 text-xs text-zinc-500 inline-flex items-center gap-2">
                {paymentIcon(p.method)} {p.method} · {moneyARS(p.amount)}
              </div>
            </div>
          ))}

          <Button
            variant="secondary"
            onClick={addPaymentLine}
            disabled={!canPay || busy || isPaid}
          >
            <PlusCircle className="h-4 w-4" />
            Agregar pago
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
