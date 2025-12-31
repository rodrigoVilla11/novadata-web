"use client";

import React from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { cn, fmtDateTimeAR, fmtMethodLabel, moneyARS } from "@/lib/adminCash/cashUtils";
import { CashDay, CashSummary } from "@/lib/adminCash/types";

export default function CashSummaryCards({
  day,
  summary,
}: {
  day: CashDay | null;
  summary: CashSummary | null;
}) {
  const countedLabel = day?.countedCash == null ? "—" : moneyARS(day.countedCash);

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader title="Efectivo" subtitle="Arqueo y esperado" />
        <CardBody>
          <div className="text-sm text-zinc-600 space-y-2">
            <div className="flex items-center justify-between">
              <span>Apertura</span>
              <b>{moneyARS(day?.openingCash ?? 0)}</b>
            </div>
            <div className="flex items-center justify-between">
              <span>Esperado (efectivo)</span>
              <b>{moneyARS(day?.expectedCash ?? 0)}</b>
            </div>
            <div className="flex items-center justify-between">
              <span>Contado</span>
              <b>{countedLabel}</b>
            </div>
            <div className="h-px bg-zinc-100 my-2" />
            <div className="flex items-center justify-between">
              <span>Diferencia</span>
              <b
                className={cn(
                  (day?.diffCash ?? 0) === 0 ? "text-emerald-700" : "text-rose-700"
                )}
              >
                {moneyARS(day?.diffCash ?? 0)}
              </b>
            </div>
          </div>

          <div className="mt-4 text-xs text-zinc-500">
            <div>Apertura: {day?.openedAt ? fmtDateTimeAR(day.openedAt) : "—"}</div>
            <div>Cierre: {day?.closedAt ? fmtDateTimeAR(day.closedAt) : "—"}</div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Por método" subtitle="Ingresos / egresos" />
        <CardBody>
          {!summary ? (
            <div className="text-sm text-zinc-500">Cargando…</div>
          ) : (
            <div className="space-y-3">
              {summary.byMethod.map((m) => (
                <div
                  key={m.method}
                  className="rounded-2xl border border-zinc-200 bg-white px-3 py-2"
                >
                  <div className="flex items-center justify-between text-sm">
                    <b className="text-zinc-900">{fmtMethodLabel(m.method)}</b>
                    <span className="text-zinc-600">
                      Neto: <b>{moneyARS(m.net)}</b>
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs text-zinc-600">
                    <span className="text-emerald-700">+ {moneyARS(m.income)}</span>
                    <span className="text-rose-700">- {moneyARS(m.expense)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Por categoría" subtitle="Finance" />
        <CardBody>
          {!summary ? (
            <div className="text-sm text-zinc-500">Cargando…</div>
          ) : summary.byCategory.length === 0 ? (
            <div className="text-sm text-zinc-500">Sin categorías usadas hoy.</div>
          ) : (
            <div className="space-y-2 max-h-[320px] overflow-auto pr-1">
              {summary.byCategory.map((c) => (
                <div
                  key={c.categoryId}
                  className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-zinc-900 truncate">{c.name}</div>
                    <div className="text-xs text-zinc-500">
                      +{moneyARS(c.income)} / -{moneyARS(c.expense)}
                    </div>
                  </div>
                  <div
                    className={cn(
                      "font-semibold",
                      c.net >= 0 ? "text-emerald-700" : "text-rose-700"
                    )}
                  >
                    {moneyARS(c.net)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
