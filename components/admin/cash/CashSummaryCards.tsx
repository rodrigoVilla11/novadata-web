"use client";

import React, { useMemo } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import {
  cn,
  fmtDateTimeAR,
  fmtMethodLabel,
  moneyARS,
} from "@/lib/adminCash/cashUtils";
import type { CashDay, CashSummary } from "@/lib/adminCash/types";

function Row({
  label,
  value,
  valueClassName,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-zinc-600">{label}</span>
      <span className={cn("font-semibold text-zinc-900", valueClassName)}>
        {value}
      </span>
    </div>
  );
}

function TinyHint({ children }: { children: React.ReactNode }) {
  return <div className="text-xs text-zinc-500">{children}</div>;
}

export default function CashSummaryCards({
  day,
  summary,
}: {
  day: CashDay | null;
  summary: CashSummary | null;
}) {
  const openingCash = day?.openingCash ?? 0;
  const expectedCash = day?.expectedCash ?? 0;
  const countedCash = day?.countedCash;
  const diffCash = day?.diffCash ?? 0;

  const countedLabel = countedCash == null ? "—" : moneyARS(countedCash);

  const diffTone = diffCash === 0 ? "ok" : diffCash > 0 ? "warn" : "error";
  const diffLabel = useMemo(() => {
    // opcional: explicar signo
    if (!day) return null;
    if (day.countedCash == null) return "Falta contado (arqueo).";
    if (diffCash === 0) return "Arqueo OK.";
    if (diffCash > 0) return "Sobra efectivo vs esperado.";
    return "Falta efectivo vs esperado.";
  }, [day, diffCash]);

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {/* =================================================================== */}
      {/* Efectivo */}
      {/* =================================================================== */}
      <Card>
        <CardHeader title="Efectivo" subtitle="Arqueo y esperado" />
        <CardBody>
          <div className="space-y-2">
            <Row label="Apertura" value={moneyARS(openingCash)} />
            <Row label="Esperado (efectivo)" value={moneyARS(expectedCash)} />
            <Row label="Contado" value={countedLabel} />

            <div className="my-2 h-px bg-zinc-100" />

            <Row
              label="Diferencia"
              value={moneyARS(diffCash)}
              valueClassName={cn(
                diffCash === 0
                  ? "text-emerald-700"
                  : diffCash > 0
                  ? "text-amber-700"
                  : "text-rose-700"
              )}
            />

            {diffLabel ? (
              <div
                className={cn(
                  "mt-2 rounded-2xl border px-3 py-2 text-xs",
                  diffTone === "ok"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : diffTone === "warn"
                    ? "border-amber-200 bg-amber-50 text-amber-900"
                    : "border-rose-200 bg-rose-50 text-rose-800"
                )}
              >
                {diffLabel}
              </div>
            ) : null}
          </div>

          <div className="mt-4 space-y-1">
            <TinyHint>
              Apertura: {day?.openedAt ? fmtDateTimeAR(day.openedAt) : "—"}
            </TinyHint>
            <TinyHint>
              Cierre: {day?.closedAt ? fmtDateTimeAR(day.closedAt) : "—"}
            </TinyHint>
          </div>
        </CardBody>
      </Card>

      {/* =================================================================== */}
      {/* Por método */}
      {/* =================================================================== */}
      <Card>
        <CardHeader title="Por método" subtitle="Ingresos / egresos" />
        <CardBody>
          {!summary ? (
            <div className="text-sm text-zinc-500">Cargando…</div>
          ) : summary.byMethod.length === 0 ? (
            <div className="text-sm text-zinc-500">
              No hay movimientos por método.
            </div>
          ) : (
            <div className="space-y-3">
              {summary.byMethod.map((m) => (
                <div
                  key={m.method}
                  className="rounded-2xl border border-zinc-200 bg-white px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <b className="min-w-0 truncate text-zinc-900">
                      {fmtMethodLabel(m.method)}
                    </b>

                    <span
                      className={cn(
                        "shrink-0 text-zinc-600",
                        m.net < 0 && "text-rose-700"
                      )}
                    >
                      Neto:{" "}
                      <b className={cn(m.net >= 0 ? "text-zinc-900" : "")}>
                        {moneyARS(m.net)}
                      </b>
                    </span>
                  </div>

                  <div className="mt-1 flex items-center justify-between text-xs">
                    <span className="text-emerald-700">
                      + {moneyARS(m.income)}
                    </span>
                    <span className="text-rose-700">- {moneyARS(m.expense)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {/* =================================================================== */}
      {/* Por categoría */}
      {/* =================================================================== */}
      <Card>
        <CardHeader title="Por categoría" subtitle="Finance" />
        <CardBody>
          {!summary ? (
            <div className="text-sm text-zinc-500">Cargando…</div>
          ) : summary.byCategory.length === 0 ? (
            <div className="text-sm text-zinc-500">Sin categorías usadas hoy.</div>
          ) : (
            <div className="max-h-80 space-y-2 overflow-auto pr-1">
              {summary.byCategory.map((c) => (
                <div
                  key={c.categoryId}
                  className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-zinc-900">
                      {c.name}
                    </div>
                    <div className="text-xs text-zinc-500">
                      +{moneyARS(c.income)} / -{moneyARS(c.expense)}
                    </div>
                  </div>

                  <div
                    className={cn(
                      "shrink-0 font-semibold",
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
