"use client";

import React from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { BadgeDollarSign, PackageOpen, PlusCircle, Trash2 } from "lucide-react";

import type { FinanceCategory, Fulfillment, PaymentMethod, PosPaymentDraft } from "@/lib/adminPos/types";
import { cn, isValidNumberDraft, moneyARS, num } from "@/lib/adminPos/helpers";
import { fulfillmentMeta, paymentIcon } from "@/lib/adminPos/ui";

export default function PaymentsCard({
  canUsePos,
  busy,
  loading,
  creatingOrder,

  // payment lines
  payments,
  onAddPaymentLine,
  onRemovePaymentLine,
  onUpdatePayment,

  // totals
  cartTotal,
  paymentsTotal,
  diff,

  // fulfillment
  fulfillment,
  deliveryNeedsData,

  // concept/category/note
  concept,
  setConcept,
  categoryId,
  setCategoryId,
  note,
  setNote,
  activeCategories,

  // CTAs
  canCreateOrder,
  canCheckout,
  onCreateOrderOnly,
  onCheckout,
}: {
  canUsePos: boolean;
  busy: boolean;
  loading: boolean;
  creatingOrder: boolean;

  payments: PosPaymentDraft[];
  onAddPaymentLine: () => void;
  onRemovePaymentLine: (ix: number) => void;
  onUpdatePayment: (ix: number, patch: Partial<PosPaymentDraft>) => void;

  cartTotal: number;
  paymentsTotal: number;
  diff: number;

  fulfillment: Fulfillment;
  deliveryNeedsData: boolean;

  concept: string;
  setConcept: (v: string) => void;
  categoryId: string;
  setCategoryId: (v: string) => void;
  note: string;
  setNote: (v: string) => void;
  activeCategories: FinanceCategory[];

  canCreateOrder: boolean;
  canCheckout: boolean;
  onCreateOrderOnly: () => Promise<void> | void;
  onCheckout: () => Promise<void> | void;
}) {
  const fMeta = fulfillmentMeta(fulfillment);

  return (
    <Card>
      <CardHeader title="Cobro" subtitle="Pagos + checkout" />
      <CardBody>
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-3">
            {payments.map((p, ix) => (
              <div key={ix} className="rounded-2xl border border-zinc-200 bg-white p-3">
                <div className="grid gap-3 md:grid-cols-4">
                  <Field label="Método">
                    <Select
                      value={p.method}
                      onChange={(e) =>
                        onUpdatePayment(ix, { method: e.target.value as PaymentMethod })
                      }
                      disabled={!canUsePos || busy}
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
                        onUpdatePayment(ix, { amount: num(e.target.value) });
                      }}
                      disabled={!canUsePos || busy}
                    />
                  </Field>

                  <Field label="Nota (pago)">
                    <Input
                      value={p.note ?? ""}
                      onChange={(e) => onUpdatePayment(ix, { note: e.target.value })}
                      placeholder="Opcional"
                      disabled={!canUsePos || busy}
                    />
                  </Field>

                  <div className="flex items-end justify-end gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => onRemovePaymentLine(ix)}
                      disabled={!canUsePos || busy || payments.length <= 1}
                      title="Eliminar línea"
                    >
                      <Trash2 className="h-4 w-4" />
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

            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                onClick={onAddPaymentLine}
                disabled={!canUsePos || busy}
              >
                <PlusCircle className="h-4 w-4" />
                Agregar pago
              </Button>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <Field label="Concepto (caja)">
                <Input
                  value={concept}
                  onChange={(e) => setConcept(e.target.value)}
                  placeholder="VENTA POS"
                  disabled={!canUsePos || busy}
                />
              </Field>

              <Field label="Categoría (Finance) opcional">
                <Select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  disabled={!canUsePos || busy}
                >
                  <option value="">— Sin categoría —</option>
                  {activeCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Nota general (opcional)">
                <Input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Ej: sin wasabi / retiro en local…"
                  disabled={!canUsePos || busy}
                />
              </Field>
            </div>
          </div>

          {/* Sticky summary */}
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 lg:sticky lg:top-24 h-fit">
            <div className="text-sm text-zinc-600">
              <div className="flex items-center justify-between">
                <span>Total carrito</span>
                <b className="text-zinc-900">{moneyARS(cartTotal)}</b>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span>Total pagos</span>
                <b className="text-zinc-900">{moneyARS(paymentsTotal)}</b>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span>Diferencia</span>
                <b className={cn(diff >= 0 ? "text-emerald-700" : "text-rose-700")}>
                  {moneyARS(diff)}
                </b>
              </div>

              <div className="h-px bg-zinc-200 my-3" />

              <div className="flex items-center justify-between text-xs">
                <span className="inline-flex items-center gap-2 text-zinc-500">
                  {fMeta.icon} Tipo
                </span>
                <b className="text-zinc-900">{fMeta.label}</b>
              </div>

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

              <div className="h-px bg-zinc-200 my-3" />

              <div className="text-xs text-zinc-500">
                Reglas:
                <ul className="list-disc pl-4 mt-1 space-y-1">
                  <li>Crear pedido: no requiere pagos.</li>
                  <li>Checkout: pagos deben cubrir el total.</li>
                  <li>Checkout genera Order + Sale + caja/stock.</li>
                </ul>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-2">
              <Button
                variant="secondary"
                onClick={onCreateOrderOnly}
                disabled={!canCreateOrder || busy || loading || creatingOrder}
                loading={creatingOrder}
              >
                <PackageOpen className="h-4 w-4" />
                Crear pedido (sin cobrar)
              </Button>

              <Button
                onClick={onCheckout}
                disabled={!canCheckout || busy || loading}
                loading={busy}
              >
                <BadgeDollarSign className="h-4 w-4" />
                Cobrar (Checkout)
              </Button>

              {!canCreateOrder && (
                <div className="text-xs text-zinc-500">
                  {deliveryNeedsData
                    ? "Delivery: completá Nombre y Dirección."
                    : "Agregá productos para crear el pedido."}
                </div>
              )}

              {canCreateOrder && !canCheckout && (
                <div className="text-xs text-zinc-500">
                  Podés crear el pedido ahora y cobrarlo después (admin/orders).
                </div>
              )}
            </div>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
