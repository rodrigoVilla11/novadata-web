"use client";

import React, { useMemo } from "react";
import { Button } from "@/components/ui/Button";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Trash2,
  XCircle,
  Copy,
} from "lucide-react";
import {
  cn,
  fmtDateTimeAR,
  fmtMethodLabel,
  moneyARS,
} from "@/lib/adminCash/cashUtils";
import type { CashMovement } from "@/lib/adminCash/types";

function TypePill({ type }: { type: CashMovement["type"] }) {
  const isIncome = type === "INCOME";
  return (
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
  );
}

function VoidBadge({ reason }: { reason?: string | null }) {
  return (
    <div className="mt-1 inline-flex items-center gap-1 text-xs text-zinc-500">
      <XCircle className="h-3.5 w-3.5" />
      Anulado{reason ? ` (${reason})` : ""}
    </div>
  );
}

async function copyText(txt: string) {
  try {
    await navigator.clipboard.writeText(txt);
  } catch {
    // noop
  }
}

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
  const canVoid = canWrite || isAdmin;

  const netTone =
    footerTotals.net === 0
      ? "text-zinc-900"
      : footerTotals.net > 0
      ? "text-emerald-700"
      : "text-rose-700";

  const hasRows = rows.length > 0;

  const topHint = useMemo(() => {
    if (loading && !hasRows) return "Cargando…";
    if (!loading && !hasRows) return "No hay movimientos para los filtros actuales.";
    return null;
  }, [loading, hasRows]);

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <div className="border-b border-zinc-100 px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">Movimientos</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Podés anular un movimiento (queda auditado).
            </p>
          </div>

          <div className="text-xs text-zinc-500">
            Día: <b className="text-zinc-700">{movementsTotal}</b>{" "}
            <span className="text-zinc-300">·</span> Filtrados:{" "}
            <b className="text-zinc-700">{rows.length}</b>
          </div>
        </div>

        {topHint ? (
          <div className="mt-3 text-sm text-zinc-500">{topHint}</div>
        ) : null}
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

                const rowDisabled = m.voided || busy || !canVoid;

                return (
                  <tr
                    key={m.id}
                    className={cn(
                      "align-top",
                      m.voided ? "opacity-60" : "hover:bg-zinc-50"
                    )}
                  >
                    <td className="px-4 py-3 text-sm text-zinc-600">
                      <div className="whitespace-nowrap">
                        {fmtDateTimeAR(m.createdAt)}
                      </div>
                      <button
                        type="button"
                        className="mt-1 inline-flex items-center gap-1 text-xs text-zinc-500 underline decoration-zinc-300 hover:decoration-zinc-500"
                        onClick={() => copyText(m.id)}
                        title="Copiar ID"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        copiar ID
                      </button>
                    </td>

                    <td className="px-4 py-3 text-sm">
                      <TypePill type={m.type} />
                      {m.voided ? <VoidBadge reason={m.voidReason} /> : null}
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

                    <td className="px-4 py-3 text-sm text-zinc-700">
                      <span className="truncate">{catName}</span>
                    </td>

                    <td className="px-4 py-3 text-sm text-zinc-700">
                      <div className="font-medium text-zinc-900">
                        {m.concept || "—"}
                      </div>
                      {m.note ? (
                        <div className="mt-0.5 text-xs text-zinc-500">
                          {m.note}
                        </div>
                      ) : null}
                    </td>

                    <td className="px-4 py-3 text-sm">
                      <Button
                        variant="danger"
                        disabled={rowDisabled}
                        onClick={() => onVoid(m)}
                        title={
                          m.voided
                            ? "Ya anulado"
                            : !canVoid
                            ? "Caja cerrada: no se puede anular"
                            : "Anular"
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                        Anular
                      </Button>
                      {!canVoid && (
                        <div className="mt-1 text-xs text-zinc-500">
                          Caja cerrada
                        </div>
                      )}
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
          <span className="text-zinc-400">·</span> Neto:{" "}
          <b className={netTone}>{moneyARS(footerTotals.net)}</b>
        </span>
      </div>
    </div>
  );
}
