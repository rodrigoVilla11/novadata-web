"use client";

import React from "react";
import Modal from "./Modal";
import { Field, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Wallet } from "lucide-react";
import { isValidNumberDraft } from "@/lib/adminCash/cashUtils";

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
  return (
    <Modal
      open={open}
      title="Apertura de caja"
      description="Definí el efectivo inicial para el día."
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={onConfirm} loading={busy}>
            <Wallet className="h-4 w-4" />
            Guardar apertura
          </Button>
        </>
      }
    >
      <div className="grid gap-3">
        <Field label="Efectivo inicial (apertura)">
          <Input
            value={openingCashDraft}
            onChange={(e) =>
              isValidNumberDraft(e.target.value) && setOpeningCashDraft(e.target.value)
            }
            placeholder="0"
            disabled={busy}
          />
        </Field>
        <div className="text-xs text-zinc-500">
          Consejo: cargá el efectivo real con el que arrancás el turno.
        </div>
      </div>
    </Modal>
  );
}
