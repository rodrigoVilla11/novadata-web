"use client";

import React from "react";
import { Field, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { RefreshCcw, Wallet, Lock } from "lucide-react";
import { cn, moneyARS } from "@/lib/adminCash/cashUtils";
import type { CashDay, CashSummary } from "@/lib/adminCash/types";

function StatusPill({ status }: { status: "OPEN" | "CLOSED" }) {
  const open = status === "OPEN";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold border",
        open
          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
          : "bg-zinc-100 text-zinc-600 border-zinc-200"
      )}
    >
      {open ? "ABIERTA" : "CERRADA"}
    </span>
  );
}

function Notice({
  tone,
  children,
}: {
  tone: "error" | "ok" | "warn";
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border px-3 py-2 text-sm",
        tone === "error"
          ? "border-red-200 bg-red-50 text-red-700"
          : tone === "warn"
          ? "border-amber-200 bg-amber-50 text-amber-800"
          : "border-emerald-200 bg-emerald-50 text-emerald-700"
      )}
    >
      <span className="inline-flex items-center gap-2">
        {tone === "ok" ? (
          <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-600 text-white text-[10px]">
            ✓
          </span>
        ) : (
          <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-white text-[10px]">
            !
          </span>
        )}
        {children}
      </span>
    </div>
  );
}

export default function CashHeader({
  dateKey,
  setDateKey,
  day,
  summary,
  loading,
  busy,
  err,
  ok,
  onRefresh,
  onOpenOpeningModal,
  onOpenClose,
  hideDatePicker,
  dateLabel,
}: {
  dateKey: string;
  setDateKey: (v: string) => void;
  day: CashDay | null;
  summary: CashSummary | null;
  loading: boolean;
  busy: boolean;
  err: string | null;
  ok: string | null;
  onRefresh: () => void;
  onOpenOpeningModal: () => void;
  onOpenClose: () => void;
  hideDatePicker?: boolean;
  dateLabel?: string;
}) {
  return (
    <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            Caja diaria
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Una caja por día. Movimientos categorizados (Finance) + arqueo.
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {day ? <StatusPill status={day.status} /> : null}
            {summary ? (
              <span className="text-sm text-zinc-600">
                Neto: <b>{moneyARS(summary.totals.net)}</b>{" "}
                <span className="text-zinc-400">·</span> Ingresos:{" "}
                <b className="text-emerald-700">
                  {moneyARS(summary.totals.income)}
                </b>{" "}
                <span className="text-zinc-400">·</span> Egresos:{" "}
                <b className="text-rose-700">
                  {moneyARS(summary.totals.expense)}
                </b>
              </span>
            ) : null}
          </div>
        </div>

        <div className="min-w-[260px]">
          {!hideDatePicker ? (
            <Field label="Fecha">
              <Input
                type="date"
                value={dateKey}
                onChange={(e) => setDateKey(e.target.value)}
                disabled={busy || loading}
              />
            </Field>
          ) : (
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
              <div className="text-xs font-semibold text-zinc-500">
                {dateLabel || "Fecha"}
              </div>
              <div className="mt-1 text-sm font-semibold text-zinc-900">
                {dateKey}
              </div>
            </div>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={onRefresh}
              loading={busy || loading}
            >
              <RefreshCcw className="h-4 w-4" />
              Actualizar
            </Button>

            <Button
              variant="secondary"
              onClick={onOpenOpeningModal}
              disabled={!day || day.status !== "OPEN" || busy}
            >
              <Wallet className="h-4 w-4" />
              Apertura
            </Button>

            <Button
              variant={day?.status === "OPEN" ? "danger" : "secondary"}
              onClick={onOpenClose}
              disabled={!day || day.status !== "OPEN" || busy}
            >
              <Lock className="h-4 w-4" />
              Cerrar caja
            </Button>
          </div>
        </div>
      </div>

      {(err || ok) && (
        <div className="mt-4 grid gap-2">
          {err && <Notice tone="error">{err}</Notice>}
          {!err && ok && <Notice tone="ok">{ok}</Notice>}
        </div>
      )}
    </div>
  );
}
