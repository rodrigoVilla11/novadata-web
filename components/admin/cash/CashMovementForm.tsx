"use client";

import React from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Lock, PlusCircle } from "lucide-react";
import { CashMovement, FinanceCategory } from "@/lib/adminCash/types";
import { isValidNumberDraft } from "@/lib/adminCash/cashUtils";

export default function CashMovementForm({
  canWrite,
  busy,
  type,
  setType,
  method,
  setMethod,
  amount,
  setAmount,
  categoryId,
  setCategoryId,
  concept,
  setConcept,
  note,
  setNote,
  activeCategories,
  onCreate,
}: {
  canWrite: boolean;
  busy: boolean;
  type: CashMovement["type"];
  setType: (v: CashMovement["type"]) => void;
  method: CashMovement["method"];
  setMethod: (v: CashMovement["method"]) => void;
  amount: string;
  setAmount: (v: string) => void;
  categoryId: string;
  setCategoryId: (v: string) => void;
  concept: string;
  setConcept: (v: string) => void;
  note: string;
  setNote: (v: string) => void;
  activeCategories: FinanceCategory[];
  onCreate: () => void;
}) {
  return (
    <Card>
      <CardHeader
        title="Nuevo movimiento"
        subtitle="Ingreso / Egreso con método y categoría"
      />
      <CardBody>
        <div className="grid gap-4 md:grid-cols-6">
          <Field label="Tipo">
            <Select
              value={type}
              onChange={(e) => setType(e.target.value as any)}
              disabled={!canWrite || busy}
            >
              <option value="INCOME">Ingreso</option>
              <option value="EXPENSE">Egreso</option>
            </Select>
          </Field>

          <Field label="Método">
            <Select
              value={method}
              onChange={(e) => setMethod(e.target.value as any)}
              disabled={!canWrite || busy}
            >
              <option value="CASH">Efectivo</option>
              <option value="TRANSFER">Transferencia</option>
              <option value="CARD">Tarjeta</option>
              <option value="OTHER">Otro</option>
            </Select>
          </Field>

          <Field label="Monto">
            <Input
              value={amount}
              onChange={(e) =>
                isValidNumberDraft(e.target.value) && setAmount(e.target.value)
              }
              disabled={!canWrite || busy}
            />
          </Field>

          <Field label="Categoría (Finance)">
            <Select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              disabled={!canWrite || busy}
            >
              <option value="">— Sin categoría —</option>
              {activeCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Concepto">
            <Input
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              placeholder="Ej: Venta mostrador / Pago proveedor"
              disabled={!canWrite || busy}
            />
          </Field>

          <Field label="Nota">
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Opcional"
              disabled={!canWrite || busy}
            />
          </Field>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={onCreate} disabled={!canWrite || busy}>
            <PlusCircle className="h-4 w-4" />
            Agregar movimiento
          </Button>

          {!canWrite && (
            <div className="text-sm text-zinc-500 inline-flex items-center gap-2">
              <Lock className="h-4 w-4" />
              Caja cerrada: no se pueden agregar movimientos.
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
