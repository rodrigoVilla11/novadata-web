"use client";

import React from "react";
import { Button } from "@/components/ui/Button";
import { ArrowDownCircle, ArrowUpCircle, Trash2, XCircle } from "lucide-react";
import { cn, fmtDateTimeAR, fmtMethodLabel, moneyARS } from "@/lib/adminCash/cashUtils";
import type { CashMovement } from "@/lib/adminCash/types";

export default function CashMovementsTable({
  loading,
  busy,
  isAdmin,
  canWrite,
  movementsTotal,
  rows,
  categoryNameById,
  onVoid,
  footerTotals,
}: {
  loading: boolean;
  busy: boolean;
  isAdmin: boolean;
  canWrite: boolean;
  movementsTotal: number;
  rows: CashMovement[];
  categoryNameById: Map<string, string>;
  onVoid: (m: CashMovement) => void;
  footerTotals: { income: number; expense: number; net: number };
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <div className="border-b border-zinc-100 px-5 py-4">
        <h2 className="text-lg font-semibold text-zinc-900">Movimientos</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Podés anular un movimiento (queda auditado).
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
                Tipo
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">
                Método
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">
                Monto
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">
                Categoría
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">
                Concepto
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">
                Acciones
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-zinc-100">
            {(loading || busy) && rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-sm text-zinc-500">
                  Cargando…
                </td>
              </tr>
            )}

            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-sm text-zinc-500">
                  No hay movimientos para los filtros actuales.
                </td>
              </tr>
            )}

            {!loading &&
              rows.map((m) => {
                const isIncome = m.type === "INCOME";
                const catName = m.categoryId
                  ? categoryNameById.get(m.categoryId) || "—"
                  : "—";

                return (
                  <tr
                    key={m.id}
                    className={cn(m.voided ? "opacity-60" : "hover:bg-zinc-50")}
                  >
                    <td className="px-4 py-3 text-sm text-zinc-600">
                      {fmtDateTimeAR(m.createdAt)}
                    </td>

                    <td className="px-4 py-3 text-sm">
                      <span
                        className={cn(
                          "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-semibold",
                          isIncome
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-rose-200 bg-rose-50 text-rose-700"
                        )}
                      >
                        {isIncome ? (
                          <ArrowUpCircle className="h-4 w-4" />
                        ) : (
                          <ArrowDownCircle className="h-4 w-4" />
                        )}
                        {isIncome ? "INGRESO" : "EGRESO"}
                      </span>

                      {m.voided && (
                        <div className="mt-1 text-xs text-zinc-500 inline-flex items-center gap-1">
                          <XCircle className="h-3.5 w-3.5" />
                          Anulado {m.voidReason ? `(${m.voidReason})` : ""}
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3 text-sm text-zinc-700">
                      {fmtMethodLabel(m.method)}
                    </td>

                    <td className="px-4 py-3 text-sm">
                      <span
                        className={cn(
                          "font-semibold",
                          isIncome ? "text-emerald-700" : "text-rose-700"
                        )}
                      >
                        {isIncome ? "+" : "-"} {moneyARS(m.amount)}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-sm text-zinc-700">{catName}</td>

                    <td className="px-4 py-3 text-sm text-zinc-700">
                      <div className="font-medium text-zinc-900">{m.concept || "—"}</div>
                      {m.note ? <div className="text-xs text-zinc-500">{m.note}</div> : null}
                    </td>

                    <td className="px-4 py-3 text-sm">
                      <Button
                        variant="danger"
                        disabled={m.voided || busy || (!canWrite && !isAdmin)}
                        onClick={() => onVoid(m)}
                        title={m.voided ? "Ya anulado" : "Anular"}
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

      <div className="border-t border-zinc-100 px-5 py-4 text-xs text-zinc-500 flex flex-wrap items-center justify-between gap-2">
        <span>
          Movimientos (día): <b>{movementsTotal}</b> · Filtrados: <b>{rows.length}</b>
        </span>
        <span className="text-zinc-700">
          Totales (filtros, sin anulados):{" "}
          <b className="text-emerald-700">+ {moneyARS(footerTotals.income)}</b>{" "}
          <span className="text-zinc-400">·</span>{" "}
          <b className="text-rose-700">- {moneyARS(footerTotals.expense)}</b>{" "}
          <span className="text-zinc-400">·</span> Neto: <b>{moneyARS(footerTotals.net)}</b>
        </span>
      </div>
    </div>
  );
}
