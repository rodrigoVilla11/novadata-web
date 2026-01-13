"use client";

import React, { useMemo } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Lock, PlusCircle } from "lucide-react";
import type { CashMovement, FinanceCategory } from "@/lib/adminCash/types";
import { cn, isValidNumberDraft, moneyARS } from "@/lib/adminCash/cashUtils";

function Hint({
  tone,
  children,
}: {
  tone: "info" | "warn" | "error";
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border px-3 py-2 text-sm",
        tone === "info"
          ? "border-zinc-200 bg-zinc-50 text-zinc-700"
          : tone === "warn"
          ? "border-amber-200 bg-amber-50 text-amber-900"
          : "border-rose-200 bg-rose-50 text-rose-800"
      )}
    >
      {children}
    </div>
  );
}

function parseDraftAmountToNumber(draft: string) {
  // admite "1234", "1234.56", "1234,56"
  const norm = draft.trim().replace(/\./g, "").replace(",", ".");
  const n = Number(norm);
  return Number.isFinite(n) ? n : null;
}

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
  const disabled = !canWrite || busy;

  const amountNumber = useMemo(
    () => parseDraftAmountToNumber(amount),
    [amount]
  );
  const amountPreview =
    amountNumber == null ? "—" : moneyARS(Math.abs(amountNumber));

  const typeLabel = type === "INCOME" ? "Ingreso" : "Egreso";
  const typeTone = type === "INCOME" ? "text-emerald-700" : "text-rose-700";

  const methodLabel = useMemo(() => {
    switch (method) {
      case "CASH":
        return "Efectivo";
      case "TRANSFER":
        return "Transferencia";
      case "CARD":
        return "Tarjeta";
      case "OTHER":
        return "Otro";
      default:
        return method as string;
    }
  }, [method]);

  const createDisabled =
    disabled ||
    !concept.trim() ||
    amountNumber == null ||
    amountNumber <= 0 ||
    !isValidNumberDraft(amount);

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
              disabled={disabled}
            >
              <option value="INCOME">Ingreso</option>
              <option value="EXPENSE">Egreso</option>
            </Select>
          </Field>

          <Field label="Método">
            <Select
              value={method}
              onChange={(e) => setMethod(e.target.value as any)}
              disabled={disabled}
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
              placeholder="Ej: 15000"
              inputMode="decimal"
              disabled={disabled}
            />
          </Field>

          <Field label="Categoría (Finance)">
            <Select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              disabled={disabled}
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
              disabled={disabled}
            />
          </Field>

          <Field label="Nota">
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Opcional"
              disabled={disabled}
            />
          </Field>
        </div>

        <div className="mt-4 flex flex-wrap items-start gap-2">
          <Button onClick={onCreate} disabled={createDisabled} loading={busy}>
            <span className="inline-flex items-center gap-2">
              <PlusCircle className="h-4 w-4" />
              Agregar movimiento{" "}
            </span>
          </Button>

          {!canWrite ? (
            <Hint tone="warn">
              <span className="inline-flex items-center gap-2">
                <Lock className="h-4 w-4" />
                Caja cerrada: no se pueden agregar movimientos.
              </span>
            </Hint>
          ) : null}

          {canWrite && !disabled && createDisabled ? (
            <Hint tone="info">
              Completá <b>Concepto</b> y un <b>Monto</b> válido mayor a 0.
            </Hint>
          ) : null}
        </div>
      </CardBody>
    </Card>
  );
}
