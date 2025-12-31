"use client";

import React from "react";
import { Field, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Lock, Unlock } from "lucide-react";
import { CashDay } from "@/lib/adminCash/types";
import Modal from "./Modal";
import { cn, isValidNumberDraft, moneyARS } from "@/lib/adminCash/cashUtils";

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
  return (
    <Modal
      open={open}
      title="Cerrar caja"
      description="Ingresá el efectivo contado y confirmá el cierre."
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            onClick={onConfirm}
            loading={busy}
            disabled={!day || day.status !== "OPEN"}
          >
            <Lock className="h-4 w-4" />
            Confirmar cierre
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-zinc-600">Esperado (efectivo)</span>
            <b className="text-zinc-900">{moneyARS(day?.expectedCash ?? 0)}</b>
          </div>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-zinc-600">Apertura</span>
            <b className="text-zinc-900">{moneyARS(day?.openingCash ?? 0)}</b>
          </div>
        </div>

        <Field label="Efectivo contado">
          <Input
            value={countedCash}
            onChange={(e) =>
              isValidNumberDraft(e.target.value) &&
              setCountedCash(e.target.value)
            }
            placeholder="0"
            disabled={busy}
          />
        </Field>

        {showOverride ? (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={cn(
                "h-10 rounded-xl border px-3 text-sm font-semibold inline-flex items-center gap-2",
                adminOverride
                  ? "border-amber-200 bg-amber-50 text-amber-800"
                  : "border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50",
                !isAdmin && "opacity-60 cursor-not-allowed"
              )}
              onClick={() => isAdmin && setAdminOverride(!adminOverride)}
              disabled={!isAdmin}
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
                ? "Permitís cerrar incluso si falta el contado."
                : "Requiere contado para cerrar."}
            </span>
          </div>
        ) : null}

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
