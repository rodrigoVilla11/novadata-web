"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AdminProtected } from "@/components/AdminProtected";
import { useAuth } from "@/app/providers/AuthProvider";
import { apiFetchAuthed } from "@/lib/apiAuthed";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Field";
import {
  ArrowRight,
  ArrowLeftRight,
  RefreshCcw,
  CheckCircle2,
  AlertTriangle,
  Repeat2,
  X,
} from "lucide-react";

/* ================= helpers ================= */

function todayKeyArgentina() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Cordoba",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function moneyARS(n: number) {
  const v = Number(n ?? 0) || 0;
  return v.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

/* ================= types ================= */

type FinanceAccountRow = {
  id: string;
  name: string;
  type: "CASH" | "BANK" | "WALLET";
  currency?: string;
  isActive?: boolean;
};

/* ================= page ================= */

export default function AdminFinanceTransferPage() {
  const { getAccessToken } = useAuth();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [accounts, setAccounts] = useState<FinanceAccountRow[]>([]);
  const [dateKey, setDateKey] = useState(todayKeyArgentina());

  const [fromAccountId, setFromAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");

  const [accountsScope, setAccountsScope] = useState<"ACTIVE" | "ALL">("ACTIVE");

  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  async function loadAccounts() {
    const params =
      accountsScope === "ACTIVE"
        ? { active: true }
        : ({ active: undefined } as any);

    const acc = await apiFetchAuthed<FinanceAccountRow[]>(
      getAccessToken,
      "/finance/accounts",
      { method: "GET", params } as any
    );

    setAccounts(acc || []);
  }

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        await loadAccounts();
      } catch (e: any) {
        setError("Error cargando cuentas");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line
  }, [accountsScope]);

  const accountLabelById = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of accounts) {
      m.set(a.id, `${a.name} (${a.type})${a.currency ? ` ${a.currency}` : ""}`);
    }
    return m;
  }, [accounts]);

  const parsedAmount = useMemo(() => {
    const raw = amount.replace(/\./g, "").replace(/,/g, ".");
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  }, [amount]);

  const sameAccount =
    fromAccountId && toAccountId && fromAccountId === toAccountId;

  const canSubmit =
    !!dateKey &&
    !!fromAccountId &&
    !!toAccountId &&
    !sameAccount &&
    parsedAmount > 0 &&
    !busy;

  async function createTransfer() {
    setError(null);
    setOkMsg(null);
    setBusy(true);

    try {
      await apiFetchAuthed(getAccessToken, "/finance/movements", {
        method: "POST",
        body: JSON.stringify({
          dateKey,
          type: "TRANSFER",
          amount: parsedAmount,
          accountId: fromAccountId,
          toAccountId,
          notes: notes.trim() || null,
        }),
      });

      setOkMsg("Transferencia registrada correctamente");
      setAmount("");
      setNotes("");
    } catch (e: any) {
      setError("Error registrando transferencia");
    } finally {
      setBusy(false);
    }
  }

  function swapAccounts() {
    setFromAccountId(toAccountId);
    setToAccountId(fromAccountId);
  }

  return (
    <AdminProtected>
      <div className="min-h-screen bg-zinc-50">
        {/* Header */}
        <div className="sticky top-0 z-10 border-b bg-white/80 backdrop-blur">
          <div className="mx-auto max-w-3xl px-4 py-4">
            <div className="flex justify-between items-start gap-3">
              <div>
                <h1 className="text-2xl font-semibold text-zinc-900">
                  Transferencias
                </h1>
                <p className="text-sm text-zinc-500">
                  Movimiento interno entre cuentas
                </p>
              </div>

              <Button
                variant="secondary"
                onClick={loadAccounts}
                loading={loading}
              >
                <RefreshCcw className="h-4 w-4" />
              </Button>
            </div>

            {(error || okMsg) && (
              <div className="mt-3">
                {error && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    {error}
                  </div>
                )}
                {okMsg && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    {okMsg}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
          <Card>
            <CardHeader
              title="Nueva transferencia"
              subtitle="Origen → destino, sin impacto en ingresos o gastos."
            />

            <CardBody>
              {/* FORM */}
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Fecha">
                  <Input
                    type="date"
                    value={dateKey}
                    onChange={(e) => setDateKey(e.target.value)}
                  />
                </Field>

                <Field label="Monto">
                  <Input
                    inputMode="decimal"
                    placeholder="Ej: 200000"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                  <div className="mt-1 text-xs text-zinc-500">
                    {moneyARS(parsedAmount)}
                  </div>
                </Field>

                <Field label="Cuenta origen">
                  <Select
                    value={fromAccountId}
                    onChange={(e) => setFromAccountId(e.target.value)}
                  >
                    <option value="">Seleccionar…</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {accountLabelById.get(a.id)}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field label="Cuenta destino">
                  <Select
                    value={toAccountId}
                    onChange={(e) => setToAccountId(e.target.value)}
                  >
                    <option value="">Seleccionar…</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {accountLabelById.get(a.id)}
                      </option>
                    ))}
                  </Select>
                </Field>

                <div className="md:col-span-2 flex items-center gap-2">
                  <Button
                    variant="secondary"
                    onClick={swapAccounts}
                    disabled={!fromAccountId || !toAccountId}
                  >
                    <Repeat2 className="h-4 w-4" />
                    Invertir cuentas
                  </Button>

                  {sameAccount && (
                    <span className="text-xs font-semibold text-amber-700">
                      Origen y destino no pueden ser iguales
                    </span>
                  )}
                </div>

                <div className="md:col-span-2">
                  <Field label="Notas (opcional)">
                    <Input
                      placeholder="Ej: Depósito de caja"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </Field>
                </div>
              </div>

              {/* SUMMARY */}
              <div className="mt-6 rounded-2xl border bg-zinc-50 p-4">
                <div className="flex items-center justify-between text-sm font-semibold">
                  <span>
                    {fromAccountId
                      ? accountLabelById.get(fromAccountId)
                      : "—"}
                  </span>
                  <ArrowRight className="h-4 w-4 text-zinc-400" />
                  <span>
                    {toAccountId ? accountLabelById.get(toAccountId) : "—"}
                  </span>
                </div>

                <div className="mt-2 text-lg font-bold text-center">
                  {moneyARS(parsedAmount)}
                </div>
              </div>

              <div className="mt-5">
                <Button
                  onClick={createTransfer}
                  disabled={!canSubmit}
                  loading={busy}
                >
                  Registrar transferencia
                </Button>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </AdminProtected>
  );
}
