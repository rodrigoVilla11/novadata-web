"use client";

import React from "react";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { RefreshCcw, ShoppingCart } from "lucide-react";
import Notice from "./Notice";
import { Fulfillment } from "@/lib/adminPos/types";
import { cn, fulfillmentMeta, moneyARS } from "@/lib/adminOrders/helpers";

export default function PosHeader({
  dateKey,
  setDateKey,
  cartTotal,
  paymentsTotal,
  diff,
  fulfillment,
  busy,
  loading,
  canUsePos,
  err,
  ok,
  onRefresh,
}: {
  dateKey: string;
  setDateKey: (v: string) => void;
  cartTotal: number;
  paymentsTotal: number;
  diff: number;
  fulfillment: Fulfillment;
  busy: boolean;
  loading: boolean;
  canUsePos: boolean;
  err: string | null;
  ok: string | null;
  onRefresh: () => Promise<void> | void;
}) {
  const fMeta = fulfillmentMeta(fulfillment);

  return (
    <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            POS
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Crear pedido (sin cobrar) o cobrar directo.
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-zinc-600">
            <span className="inline-flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" />
              Total: <b>{moneyARS(cartTotal)}</b>
            </span>
            <span className="text-zinc-400">·</span>
            <span>
              Pagos: <b>{moneyARS(paymentsTotal)}</b>
            </span>
            <span className="text-zinc-400">·</span>
            <span className={cn(diff >= 0 ? "text-emerald-700" : "text-rose-700")}>
              Dif: <b>{moneyARS(diff)}</b>
            </span>
            <span className="text-zinc-400">·</span>
            <span className="inline-flex items-center gap-2">
              {fMeta.icon}
              <b>{fMeta.label}</b>
            </span>
          </div>
        </div>

        <div className="min-w-[260px]">
          <Field label="Fecha (dateKey) — solo para caja/ventas">
            <Input
              type="date"
              value={dateKey}
              onChange={(e) => setDateKey(e.target.value)}
              disabled={busy || loading}
            />
          </Field>

          <div className="mt-3">
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                onClick={onRefresh}
                loading={busy || loading}
              >
                <RefreshCcw className="h-4 w-4" />
                Actualizar
              </Button>
            </div>
          </div>
        </div>
      </div>

      {(err || ok) && (
        <div className="mt-4 grid gap-2">
          {err && <Notice tone="error">{err}</Notice>}
          {!err && ok && <Notice tone="ok">{ok}</Notice>}
        </div>
      )}

      {!canUsePos && (
        <div className="mt-4">
          <Notice tone="warn">
            Tu usuario no tiene roles para usar POS (ADMIN/MANAGER/CASHIER).
          </Notice>
        </div>
      )}
    </div>
  );
}
