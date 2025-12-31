"use client";

import React from "react";
import { Button } from "@/components/ui/Button";
import { Trash2 } from "lucide-react";
import { SaleRow } from "@/lib/adminPos/types";
import { cn, moneyARS } from "@/lib/adminOrders/helpers";

export default function SalesTable({
  sales,
  loadingSales,
  loading,
  busy,
  dateKey,
  onVoidClick,
}: {
  sales: SaleRow[];
  loadingSales: boolean;
  loading: boolean;
  busy: boolean;
  dateKey: string;
  onVoidClick: (sale: SaleRow) => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <div className="border-b border-zinc-100 px-5 py-4">
        <h2 className="text-lg font-semibold text-zinc-900">Ventas del día</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Podés anular una venta (PATCH /sales/:id/void).
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
            {(loadingSales || loading) && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-sm text-zinc-500">
                  Cargando…
                </td>
              </tr>
            )}

            {!loadingSales && !loading && sales.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-sm text-zinc-500">
                  No hay ventas para esta fecha.
                </td>
              </tr>
            )}

            {!loadingSales &&
              !loading &&
              sales.map((s) => {
                const voided = s.status === "VOIDED";
                const canVoid = !voided;

                return (
                  <tr
                    key={s.id}
                    className={cn(voided ? "opacity-70" : "hover:bg-zinc-50")}
                  >
                    <td className="px-4 py-3 text-sm text-zinc-600">
                      {new Date(s.createdAt).toLocaleString("es-AR")}
                    </td>

                    <td className="px-4 py-3 text-sm text-zinc-700">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold",
                          s.status === "PAID"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : s.status === "VOIDED"
                            ? "border-zinc-200 bg-zinc-100 text-zinc-600"
                            : "border-amber-200 bg-amber-50 text-amber-800"
                        )}
                      >
                        {s.status}
                      </span>

                      {voided && s.voidReason ? (
                        <div className="mt-1 text-xs text-zinc-500">
                          Motivo: {s.voidReason}
                        </div>
                      ) : null}
                    </td>

                    <td className="px-4 py-3 text-sm font-semibold text-zinc-900">
                      {moneyARS(s.total)}
                    </td>

                    <td className="px-4 py-3 text-sm">
                      <Button
                        variant="danger"
                        disabled={busy || !canVoid}
                        onClick={() => onVoidClick(s)}
                        title={voided ? "Ya anulada" : "Anular venta"}
                      >
                        <Trash2 className="h-4 w-4" />
                        Anular
                      </Button>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      <div className="border-t border-zinc-100 px-5 py-4 text-xs text-zinc-500">
        Ventas: <b>{sales.length}</b> · dateKey: <b>{dateKey}</b>
      </div>
    </div>
  );
}
