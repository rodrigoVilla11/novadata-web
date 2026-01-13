"use client";

import React, { useEffect, useMemo, useRef } from "react";
import { Field, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Lock, Unlock, X, Info, AlertTriangle, Minus, Plus } from "lucide-react";
import { CashDay } from "@/lib/adminCash/types";
import Modal from "./Modal";
import { cn, isValidNumberDraft, moneyARS } from "@/lib/adminCash/cashUtils";

function draftToNumber(draft: string) {
  const n = Number((draft || "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export default function CloseCashModal({
  open,
  busy,
  isAdmin,
  day,
  countedCash,
  setCountedCash,
  adminOverride,
  setAdminOverride,
  closeNote,
  setCloseNote,
  onClose,
  onConfirm,
  showOverride = true,
}: {
  open: boolean;
  busy: boolean;
  isAdmin: boolean;
  day: CashDay | null;
  countedCash: string;
  setCountedCash: (v: string) => void;
  adminOverride: boolean;
  setAdminOverride: (v: boolean) => void;
  closeNote: string;
  setCloseNote: (v: string) => void;
  onClose: () => void;
  onConfirm: () => void;
  showOverride?: boolean;
}) {
  const countedRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => countedRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [open]);

  const expected = day?.expectedCash ?? 0;
  const opening = day?.openingCash ?? 0;

  const countedNum = useMemo(() => draftToNumber(countedCash), [countedCash]);
  const diff = useMemo(() => countedNum - expected, [countedNum, expected]);

  const diffTone =
    diff === 0 ? "text-zinc-900" : diff > 0 ? "text-emerald-700" : "text-rose-700";

  const dayOpen = !!day && day.status === "OPEN";

  const hasCountedDraft = countedCash.trim().length > 0;

  // UX: si no hay contado, no permitir cerrar salvo override (si está visible y activo)
  const canConfirm = useMemo(() => {
    if (!dayOpen) return false;
    if (busy) return false;

    if (showOverride && adminOverride) return true;
    return hasCountedDraft; // requiere que el usuario haya ingresado algo (0 válido)
  }, [dayOpen, busy, showOverride, adminOverride, hasCountedDraft]);

  const handleConfirm = () => {
    if (!canConfirm) return;
    onConfirm();
  };

  const bump = (delta: number) => {
    if (busy) return;
    const next = Math.max(0, Math.round((countedNum + delta) * 100) / 100);
    setCountedCash(String(next).replace(".", ".")); // draft simple
  };

  return (
    <Modal
      open={open}
      title="Cerrar caja"
      description="Ingresá el efectivo contado y confirmá el cierre."
      onClose={onClose}
      footer={
        <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            <X className="h-4 w-4" />
            Cancelar
          </Button>

          <Button
            variant="danger"
            onClick={handleConfirm}
            loading={busy}
            disabled={!canConfirm}
            title={
              !dayOpen
                ? "La caja no está abierta"
                : !canConfirm
                ? showOverride && !adminOverride
                  ? "Ingresá el contado (o activá override si sos ADMIN)"
                  : "Ingresá el contado"
                : "Confirmar cierre"
            }
          >
            <Lock className="h-4 w-4" />
            Confirmar cierre
          </Button>
        </div>
      }
    >
      <div className="grid gap-4">
        {/* Resumen esperado + apertura + diferencia */}
        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="flex items-center justify-between sm:flex-col sm:items-start sm:justify-start">
              <span className="text-xs text-zinc-500">Esperado (efectivo)</span>
              <b className="text-base text-zinc-900">{moneyARS(expected)}</b>
            </div>

            <div className="flex items-center justify-between sm:flex-col sm:items-start sm:justify-start">
              <span className="text-xs text-zinc-500">Apertura</span>
              <b className="text-base text-zinc-900">{moneyARS(opening)}</b>
            </div>

            <div className="flex items-center justify-between sm:flex-col sm:items-start sm:justify-start">
              <span className="text-xs text-zinc-500">Diferencia</span>
              <b className={cn("text-base", diffTone)}>
                {diff === 0 ? moneyARS(0) : `${diff > 0 ? "+" : "-"}${moneyARS(Math.abs(diff))}`}
              </b>
            </div>
          </div>

          {/* Nota contextual (solo si hay diff relevante) */}
          {hasCountedDraft && Math.abs(diff) > 0 ? (
            <div className="mt-3 flex items-start gap-2 rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-600">
              <AlertTriangle className="mt-0.5 h-4 w-4 text-zinc-500" />
              <div>
                Estás por cerrar con{" "}
                <span className={cn("font-semibold", diffTone)}>
                  {diff > 0 ? "sobrante" : "faltante"} de{" "}
                  {moneyARS(Math.abs(diff))}
                </span>
                . Si es correcto, podés dejar una nota.
              </div>
            </div>
          ) : (
            <div className="mt-3 flex items-start gap-2 rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-600">
              <Info className="mt-0.5 h-4 w-4 text-zinc-500" />
              <div>
                Tip: contá el efectivo real (billetes/monedas) y cargalo tal cual.
              </div>
            </div>
          )}
        </div>

        {/* Contado */}
        <Field label="Efectivo contado">
          <div className="grid gap-2">
            <div className="relative">
              <Input
                ref={countedRef}
                value={countedCash}
                onChange={(e) =>
                  isValidNumberDraft(e.target.value) &&
                  setCountedCash(e.target.value)
                }
                placeholder="0"
                disabled={busy}
                inputMode="decimal"
                className="pr-10"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleConfirm();
                }}
              />

              {!!countedCash.trim() && !busy ? (
                <button
                  type="button"
                  onClick={() => setCountedCash("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl border border-zinc-200 bg-white p-1.5 text-zinc-700 hover:bg-zinc-50"
                  aria-label="Limpiar contado"
                  title="Limpiar"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>

            {/* Accesos rápidos (mobile friendly) */}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => bump(-1000)}
                disabled={busy}
                className="h-9 rounded-2xl border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
                title="-$ 1.000"
              >
                <Minus className="mr-1 inline h-3.5 w-3.5" /> 1.000
              </button>
              <button
                type="button"
                onClick={() => bump(+1000)}
                disabled={busy}
                className="h-9 rounded-2xl border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
                title="+$ 1.000"
              >
                <Plus className="mr-1 inline h-3.5 w-3.5" /> 1.000
              </button>
              <button
                type="button"
                onClick={() => bump(+5000)}
                disabled={busy}
                className="h-9 rounded-2xl border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
                title="+$ 5.000"
              >
                <Plus className="mr-1 inline h-3.5 w-3.5" /> 5.000
              </button>
              <button
                type="button"
                onClick={() => bump(+10000)}
                disabled={busy}
                className="h-9 rounded-2xl border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
                title="+$ 10.000"
              >
                <Plus className="mr-1 inline h-3.5 w-3.5" /> 10.000
              </button>

              <span className="ml-auto inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs text-zinc-700">
                Vista previa: <span className="ml-2 font-semibold">{moneyARS(countedNum)}</span>
              </span>
            </div>
          </div>
        </Field>

        {/* Override admin */}
        {showOverride ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              className={cn(
                "h-10 rounded-2xl border px-3 text-sm font-semibold inline-flex items-center justify-center gap-2 transition",
                adminOverride
                  ? "border-amber-200 bg-amber-50 text-amber-800"
                  : "border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50",
                !isAdmin && "opacity-60 cursor-not-allowed"
              )}
              onClick={() => isAdmin && setAdminOverride(!adminOverride)}
              disabled={!isAdmin}
              aria-pressed={adminOverride}
              title={!isAdmin ? "Solo ADMIN" : "Cerrar aunque falten datos"}
            >
              {adminOverride ? (
                <Unlock className="h-4 w-4" />
              ) : (
                <Lock className="h-4 w-4" />
              )}
              Override admin
            </button>

            <span className="text-xs text-zinc-500">
              {adminOverride
                ? "Permitís cerrar incluso si no se ingresó contado."
                : "Por defecto, requiere ingresar el contado para cerrar."}
            </span>
          </div>
        ) : null}

        {/* Nota */}
        <Field label="Nota de cierre (opcional)">
          <Input
            value={closeNote}
            onChange={(e) => setCloseNote(e.target.value)}
            placeholder="Ej: faltó arqueo de tarjeta…"
            disabled={busy}
          />
        </Field>
      </div>
    </Modal>
  );
}
