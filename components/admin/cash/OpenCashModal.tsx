"use client";

import React, { useEffect, useMemo, useRef } from "react";
import Modal from "./Modal";
import { Field, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Wallet, X, Info } from "lucide-react";
import { cn, isValidNumberDraft, moneyARS } from "@/lib/adminCash/cashUtils";

function draftToNumber(draft: string) {
  // permite "123", "123.", "123.4" => parse seguro
  const n = Number((draft || "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export default function OpenCashModal({
  open,
  busy,
  openingCashDraft,
  setOpeningCashDraft,
  onClose,
  onConfirm,
}: {
  open: boolean;
  busy: boolean;
  openingCashDraft: string;
  setOpeningCashDraft: (v: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Autofocus cuando abre
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [open]);

  const numeric = useMemo(
    () => draftToNumber(openingCashDraft),
    [openingCashDraft]
  );

  const canConfirm = useMemo(() => {
    // regla UX: permitir 0 si querés, pero no permitir vacío raro
    // (si querés forzar >= 0 y no vacío, dejalo así)
    return !busy && openingCashDraft.trim().length > 0;
  }, [busy, openingCashDraft]);

  const handleConfirm = () => {
    if (!canConfirm) return;
    onConfirm();
  };

  return (
    <Modal
      open={open}
      title="Apertura de caja"
      description="Definí el efectivo inicial con el que arrancás el turno."
      onClose={onClose}
      footer={
        <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            <X className="h-4 w-4" />
            Cancelar
          </Button>

          <Button onClick={handleConfirm} loading={busy} disabled={!canConfirm}>
            <Wallet className="h-4 w-4" />
            Guardar apertura
          </Button>
        </div>
      }
    >
      <div className="grid gap-4">
        {/* Input */}
        <Field label="Efectivo inicial">
          <div className="relative">
            <Input
              ref={inputRef}
              value={openingCashDraft}
              onChange={(e) =>
                isValidNumberDraft(e.target.value) &&
                setOpeningCashDraft(e.target.value)
              }
              placeholder="0"
              disabled={busy}
              inputMode="decimal"
              className="pr-10"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleConfirm();
              }}
            />

            {!!openingCashDraft.trim() && !busy ? (
              <button
                type="button"
                onClick={() => setOpeningCashDraft("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl border border-zinc-200 bg-white p-1.5 text-zinc-700 hover:bg-zinc-50"
                aria-label="Limpiar monto"
                title="Limpiar"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>

          {/* Vista previa */}
          <div className="mt-2 flex items-center justify-between rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2">
            <span className="text-xs text-zinc-600">Vista previa</span>
            <span className={cn("text-sm font-semibold", numeric < 0 ? "text-rose-700" : "text-zinc-900")}>
              {moneyARS(numeric)}
            </span>
          </div>
        </Field>

        {/* Helper / tip */}
        <div className="flex gap-2 rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-600">
          <Info className="mt-0.5 h-4 w-4 text-zinc-500" />
          <div>
            Consejo: cargá el efectivo real con el que arrancás el turno. Si no
            hay efectivo, dejá <span className="font-semibold">0</span>.
          </div>
        </div>
      </div>
    </Modal>
  );
}
