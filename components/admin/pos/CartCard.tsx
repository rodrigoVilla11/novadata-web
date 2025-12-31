"use client";

import React from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Trash2 } from "lucide-react";
import { moneyARS } from "@/lib/adminOrders/helpers";
import { PosCartItem } from "@/lib/adminPos/types";

export default function CartCard({
  canUsePos,
  busy,
  cart,
  cartTotal,
  onRemoveItem,
  onSetQty,
  onSetNote,
  onClear,
}: {
  canUsePos: boolean;
  busy: boolean;
  cart: PosCartItem[];
  cartTotal: number;
  onRemoveItem: (productId: string) => void;
  onSetQty: (productId: string, qtyDraft: string) => void;
  onSetNote: (productId: string, noteVal: string) => void;
  onClear: () => void;
}) {
  return (
    <Card>
      <CardHeader title="Carrito" subtitle="Cantidades y notas" />
      <CardBody>
        {cart.length === 0 ? (
          <div className="text-sm text-zinc-500">
            Agregá productos desde la lista.
          </div>
        ) : (
          <div className="space-y-2 max-h-[420px] overflow-auto pr-1">
            {cart.map((it) => (
              <div
                key={it.productId}
                className="rounded-2xl border border-zinc-200 bg-white p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold text-zinc-900 truncate">
                      {it.name}
                    </div>
                    <div className="text-xs text-zinc-500">
                      Unit: <b>{moneyARS(it.unitPrice)}</b> · Línea:{" "}
                      <b>{moneyARS(it.lineTotal)}</b>
                    </div>
                  </div>

                  <Button
                    variant="danger"
                    onClick={() => onRemoveItem(it.productId)}
                    disabled={!canUsePos || busy}
                    title="Quitar"
                  >
                    <Trash2 className="h-4 w-4" />
                    Quitar
                  </Button>
                </div>

                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <Field label="Cantidad">
                    <Input
                      value={String(it.qty)}
                      onChange={(e) => onSetQty(it.productId, e.target.value)}
                      disabled={!canUsePos || busy}
                    />
                  </Field>

                  <Field label="Nota (item)">
                    <Input
                      value={it.note ?? ""}
                      onChange={(e) => onSetNote(it.productId, e.target.value)}
                      placeholder="Opcional"
                      disabled={!canUsePos || busy}
                    />
                  </Field>

                  <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
                    <div className="text-xs text-zinc-500">Subtotal</div>
                    <div className="text-lg font-semibold text-zinc-900">
                      {moneyARS(it.lineTotal)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm text-zinc-600">
            Total: <b className="text-zinc-900">{moneyARS(cartTotal)}</b>
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={onClear}
              disabled={!canUsePos || busy || cart.length === 0}
            >
              Limpiar
            </Button>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
