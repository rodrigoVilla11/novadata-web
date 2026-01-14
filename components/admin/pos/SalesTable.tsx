"use client";

import React, { useMemo } from "react";
import { Trash2 } from "lucide-react";
import type { SaleRow } from "@/lib/adminPos/types";
import { cn, moneyARS } from "@/lib/adminOrders/helpers";

function fmtDateTimeAR(value: any) {
  try {
    const d = value instanceof Date ? value : new Date(value);
    return new Intl.DateTimeFormat("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return String(value ?? "");
  }
}

function StatusPill({ status }: { status: SaleRow["status"] }) {
  const cls =
    status === "PAID"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : status === "VOIDED"
      ? "bg-zinc-100 text-zinc-600 border-zinc-200"
      : "bg-amber-50 text-amber-800 border-amber-200";

  const label =
    status === "PAID" ? "Pagada" : status === "VOIDED" ? "Anulada" : status;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold",
        cls
      )}
    >
      {label}
    </span>
  );
}

function IconButton({
  title,
  onClick,
  disabled,
  children,
}: {
  title: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className="grid h-9 w-9 place-items-center rounded-xl border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
    >
      {children}
    </button>
  );
}

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
  const stats = useMemo(() => {
    const total = sales.reduce((acc, s) => acc + (Number(s.total) || 0), 0);
    const voided = sales.filter((s) => s.status === "VOIDED").length;
    const paid = sales.filter((s) => s.status === "PAID").length;
    return { total, voided, paid };
  }, [sales]);

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
      {/* Header compacto */}
      <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
        <div>
          <div className="text-sm font-bold text-zinc-900">Ventas</div>
          <div className="text-xs text-zinc-500">Día: {dateKey}</div>
        </div>

        <div className="text-right">
          <div className="text-[11px] font-semibold text-zinc-500">Total del día</div>
          <div className="text-base font-extrabold text-emerald-700">
            {moneyARS(stats.total)}
          </div>
        </div>
      </div>

      {/* Tabla / lista */}
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-zinc-50">
            <tr>
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-zinc-500">
                Hora
              </th>
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-zinc-500">
                Estado
              </th>
              <th className="px-4 py-2.5 text-right text-[11px] font-semibold text-zinc-500">
                Total
              </th>
              <th className="px-4 py-2.5 text-right text-[11px] font-semibold text-zinc-500">
                Acción
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
                    className={cn(
                      "hover:bg-zinc-50",
                      voided && "opacity-70"
                    )}
                  >
                    <td className="px-4 py-3 text-sm text-zinc-600">
                      {fmtDateTimeAR(s.createdAt)}
                      <div className="mt-0.5 text-[11px] text-zinc-400">
                        ID: {String(s.id).slice(-6)}
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <StatusPill status={s.status} />
                      {voided && s.voidReason ? (
                        <div className="mt-1 line-clamp-1 text-[11px] text-zinc-500">
                          Motivo: {s.voidReason}
                        </div>
                      ) : null}
                    </td>

                    <td className="px-4 py-3 text-right text-sm font-extrabold text-zinc-900">
                      {moneyARS(s.total)}
                    </td>

                    <td className="px-4 py-3 text-right">
                      <IconButton
                        title={voided ? "Ya anulada" : "Anular venta"}
                        disabled={busy || !canVoid}
                        onClick={() => onVoidClick(s)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </IconButton>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      {/* Footer compacto */}
      <div className="flex items-center justify-between border-t border-zinc-100 px-4 py-3 text-xs text-zinc-500">
        <div>
          Ventas: <b className="text-zinc-700">{sales.length}</b> · Pagadas:{" "}
          <b className="text-zinc-700">{stats.paid}</b> · Anuladas:{" "}
          <b className="text-zinc-700">{stats.voided}</b>
        </div>
      </div>
    </div>
  );
}
