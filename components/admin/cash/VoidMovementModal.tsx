"use client";

import React from "react";
import Modal from "./Modal";
import { Field, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { AlertTriangle, Trash2 } from "lucide-react";
import { fmtMethodLabel, fmtTypeLabel, moneyARS } from "@/lib/adminCash/cashUtils";
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
  const desc = target
    ? `${fmtTypeLabel(target.type)} · ${fmtMethodLabel(target.method)} · ${moneyARS(
        target.amount
      )}`
    : "";

  return (
    <Modal
      open={open}
      title="Anular movimiento"
      description={desc}
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
            disabled={!target || target.voided}
          >
            <Trash2 className="h-4 w-4" />
            Confirmar anulación
          </Button>
        </>
      }
    >
      <div className="grid gap-3">
        <Field label="Razón (opcional)">
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ej: cargado por error"
            disabled={busy}
          />
        </Field>

        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 inline-flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5" />
          <span>
            La anulación queda auditada. El movimiento no se borra, se marca como
            anulado.
          </span>
        </div>
      </div>
    </Modal>
  );
}
