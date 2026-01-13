"use client";

import React, { useEffect, useMemo, useRef } from "react";
import Modal from "./Modal";
import { Field, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import {
  AlertTriangle,
  Trash2,
  X,
  Info,
  BadgeCheck,
} from "lucide-react";
import {
  cn,
  fmtMethodLabel,
  fmtTypeLabel,
  moneyARS,
} from "@/lib/adminCash/cashUtils";
import type { CashMovement } from "@/lib/adminCash/types";

export default function VoidMovementModal({
  open,
  busy,
  target,
  reason,
  setReason,
  onClose,
  onConfirm,
}: {
  open: boolean;
  busy: boolean;
  target: CashMovement | null;
  reason: string;
  setReason: (v: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const reasonRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => reasonRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [open]);

  const desc = useMemo(() => {
    if (!target) return "";
    return `${fmtTypeLabel(target.type)} · ${fmtMethodLabel(target.method)} · ${moneyARS(
      target.amount
    )}`;
  }, [target]);

  const alreadyVoided = !!target?.voided;

  const canConfirm = useMemo(() => {
    if (!target) return false;
    if (busy) return false;
    if (alreadyVoided) return false;
    return true;
  }, [target, busy, alreadyVoided]);

  const handleConfirm = () => {
    if (!canConfirm) return;
    onConfirm();
  };

  const tone =
    target?.type === "INCOME" ? "text-emerald-700" : "text-rose-700";

  return (
    <Modal
      open={open}
      title="Anular movimiento"
      description={desc || "Seleccioná un movimiento para anular."}
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
            title={alreadyVoided ? "Este movimiento ya está anulado" : "Confirmar anulación"}
          >
            <Trash2 className="h-4 w-4" />
            Confirmar anulación
          </Button>
        </div>
      }
    >
      <div className="grid gap-4">
        {/* Resumen visual del movimiento */}
        {target ? (
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold",
                      target.type === "INCOME"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                        : "border-rose-200 bg-rose-50 text-rose-800"
                    )}
                  >
                    {fmtTypeLabel(target.type)}
                  </span>

                  <span className="inline-flex items-center rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-800">
                    {fmtMethodLabel(target.method)}
                  </span>

                  {target.voided ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-600">
                      <BadgeCheck className="h-3.5 w-3.5" />
                      Ya anulado
                    </span>
                  ) : null}
                </div>

                {/* Concepto/nota si existe */}
                {(target.concept || target.note) ? (
                  <div className="mt-2 text-sm text-zinc-700">
                    <div className="truncate font-semibold">
                      {target.concept || "Sin concepto"}
                    </div>
                    {target.note ? (
                      <div className="mt-0.5 line-clamp-2 text-xs text-zinc-600">
                        {target.note}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="mt-2 text-sm text-zinc-600">
                    Sin concepto ni nota.
                  </div>
                )}
              </div>

              <div className={cn("shrink-0 text-right", tone)}>
                <div className="text-xs text-zinc-500">Monto</div>
                <div className="text-lg font-extrabold">{moneyARS(target.amount)}</div>
              </div>
            </div>
          </div>
        ) : null}

        {/* Razón */}
        <Field label="Razón (opcional)">
          <div className="relative">
            <Input
              ref={reasonRef}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej: cargado por error"
              disabled={busy || alreadyVoided}
              className="pr-10"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleConfirm();
              }}
            />
            {!!reason.trim() && !busy && !alreadyVoided ? (
              <button
                type="button"
                onClick={() => setReason("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl border border-zinc-200 bg-white p-1.5 text-zinc-700 hover:bg-zinc-50"
                aria-label="Limpiar razón"
                title="Limpiar"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </Field>

        {/* Avisos */}
        {alreadyVoided ? (
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-700 inline-flex items-start gap-2">
            <Info className="h-4 w-4 mt-0.5 text-zinc-500" />
            <span>Este movimiento ya está anulado. No se puede volver a anular.</span>
          </div>
        ) : (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 inline-flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5" />
            <span>
              La anulación queda auditada. El movimiento no se borra: se marca como
              anulado y deja trazabilidad.
            </span>
          </div>
        )}
      </div>
    </Modal>
  );
}
