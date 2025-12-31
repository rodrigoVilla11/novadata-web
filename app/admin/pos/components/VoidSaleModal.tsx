"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { AlertTriangle, XCircle } from "lucide-react";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function todayKeyArgentina() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Cordoba",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function VoidSaleModal({
  open,
  onClose,
  onConfirm,
  busy,
  saleId,
  defaultDateKey,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (data: { reason: string; dateKey: string }) => Promise<void> | void;
  busy?: boolean;
  saleId: string;
  defaultDateKey?: string | null;
}) {
  const [dateKey, setDateKey] = useState(defaultDateKey || todayKeyArgentina());
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDateKey(defaultDateKey || todayKeyArgentina());
      setReason("");
      setErr(null);
    }
  }, [open, defaultDateKey]);

  const canSubmit = useMemo(() => {
    return !!dateKey && /^\d{4}-\d{2}-\d{2}$/.test(dateKey);
  }, [dateKey]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 md:items-center">
      <div className="w-full max-w-lg rounded-3xl bg-white shadow-xl border border-zinc-200">
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-zinc-100">
          <div>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-rose-600" />
              <h3 className="text-lg font-semibold text-zinc-900">
                Anular venta
              </h3>
            </div>
            <p className="mt-1 text-sm text-zinc-500">
              Esto genera reversa de caja + reposición de stock (si estaba PAGADA).
            </p>
            <p className="mt-1 text-xs text-zinc-400">Sale ID: {saleId}</p>
          </div>

          <button
            className="rounded-xl border border-zinc-200 p-2 text-zinc-700 hover:bg-zinc-50"
            onClick={onClose}
            disabled={!!busy}
            title="Cerrar"
          >
            <XCircle className="h-5 w-5" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3">
          {err && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {err}
            </div>
          )}

          <Field label="Fecha de caja (dateKey)">
            <Input
              type="date"
              value={dateKey}
              onChange={(e) => setDateKey(e.target.value)}
              disabled={!!busy}
            />
          </Field>

          <Field label="Motivo (opcional)">
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej: error de cobro / se canceló el pedido"
              disabled={!!busy}
            />
          </Field>
        </div>

        <div className="px-5 py-4 border-t border-zinc-100 flex items-center justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={!!busy}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            loading={!!busy}
            disabled={!canSubmit || !!busy}
            onClick={async () => {
              try {
                setErr(null);
                await onConfirm({ reason, dateKey });
                onClose();
              } catch (e: any) {
                setErr(String(e?.message || "Error anulando"));
              }
            }}
          >
            Confirmar anulación
          </Button>
        </div>
      </div>
    </div>
  );
}
