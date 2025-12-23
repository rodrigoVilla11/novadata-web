"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AdminProtected } from "@/components/AdminProtected";
import { useAuth } from "@/app/providers/AuthProvider";
import { apiFetchAuthed } from "@/lib/apiAuthed";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Field";
import {
  ArrowDownUp,
  RefreshCcw,
  CheckCircle2,
  AlertTriangle,
  Repeat2,
  X,
} from "lucide-react";

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

type FinanceAccountType = "CASH" | "BANK" | "WALLET";
type FinanceAccountRow = {
  id: string;
  name: string;
  type: FinanceAccountType;
  currency?: string;
  isActive?: boolean;
};

type CreateMovementPayload = {
  dateKey: string;
  type: "TRANSFER";
  amount: number;
  accountId: string; // from
  toAccountId: string; // to
  notes?: string | null;
  categoryId?: string | null;
  providerId?: string | null;
};

export default function AdminFinanceTransferPage() {
  const { getAccessToken } = useAuth();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [accounts, setAccounts] = useState<FinanceAccountRow[]>([]);
  const [dateKey, setDateKey] = useState(todayKeyArgentina());

  const [fromAccountId, setFromAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [amount, setAmount] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  const [accountsScope, setAccountsScope] = useState<"ACTIVE" | "ALL">("ACTIVE");

  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  async function loadAccounts() {
    // Si tu backend soporta ?active=true/false y cuando no mandás nada devuelve active=true,
    // esto te permite alternar sin cambiar endpoints.
    const params =
      accountsScope === "ACTIVE" ? { active: true } : ({ active: undefined } as any);

    const acc = await apiFetchAuthed<FinanceAccountRow[]>(
      getAccessToken,
      "/finance/accounts",
      { method: "GET", params } as any
    );

    setAccounts(acc || []);
  }

  async function load() {
    setError(null);
    setLoading(true);
    try {
      await loadAccounts();
    } catch (e: any) {
      setError(e?.message || "Error cargando cuentas");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // recargar cuentas si cambia el scope
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountsScope]);

  const accountLabelById = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of accounts) {
      m.set(a.id, `${a.name} (${a.type})${a.currency ? ` ${a.currency}` : ""}`);
    }
    return m;
  }, [accounts]);

  const parsedAmount = useMemo(() => {
    // acepta "200000" o "200.000" o "200,000"
    const raw = String(amount || "").trim();
    if (!raw) return 0;
    const cleaned = raw.replace(/\./g, "").replace(/,/g, ".");
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : 0;
  }, [amount]);

  const sameAccount = fromAccountId && toAccountId && fromAccountId === toAccountId;

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

    if (sameAccount) {
      setError("La cuenta origen y destino no pueden ser iguales.");
      return;
    }
    if (!(parsedAmount > 0)) {
      setError("Monto inválido.");
      return;
    }

    const payload: CreateMovementPayload = {
      dateKey,
      type: "TRANSFER",
      amount: parsedAmount,
      accountId: fromAccountId,
      toAccountId,
      notes: notes.trim() ? notes.trim() : null,
      categoryId: null,
      providerId: null,
    };

    setBusy(true);
    try {
      await apiFetchAuthed(getAccessToken, "/finance/movements", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setOkMsg("Transferencia registrada ✔");
      setAmount("");
      setNotes("");

      window.setTimeout(() => setOkMsg(null), 2500);
    } catch (e: any) {
      setError(e?.message || "Error registrando transferencia");
    } finally {
      setBusy(false);
    }
  }

  function swapAccounts() {
    setFromAccountId(toAccountId);
    setToAccountId(fromAccountId);
  }

  function clearForm() {
    setDateKey(todayKeyArgentina());
    setAmount("");
    setNotes("");
    setFromAccountId("");
    setToAccountId("");
    setError(null);
    setOkMsg(null);
  }

  return (
    <AdminProtected>
      <div className="min-h-screen bg-zinc-50">
        <div className="sticky top-0 z-10 border-b border-zinc-200 bg-white/80 backdrop-blur">
          <div className="mx-auto max-w-3xl px-4 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold text-zinc-900">
                  Finance • Transferencias (Admin)
                </h1>
                <p className="mt-1 text-sm text-zinc-500">
                  Movimientos internos entre cuentas (no afecta ingresos/gastos).
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  onClick={load}
                  disabled={loading || busy}
                  loading={loading}
                >
                  <span className="inline-flex items-center gap-2">
                    <RefreshCcw className="h-4 w-4" />
                    Recargar
                  </span>
                </Button>
              </div>
            </div>

            {(error || okMsg) && (
              <div className="mt-3 grid gap-2">
                {error && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    <span className="inline-flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      {error}
                    </span>
                  </div>
                )}
                {okMsg && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                    <span className="inline-flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4" />
                      {okMsg}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
          <Card>
            <CardHeader
              title="Nueva transferencia"
              subtitle="Crea un movimiento TRANSFER (origen → destino)."
              right={
                <div className="flex items-center gap-2">
                  <Select
                    value={accountsScope}
                    onChange={(e) => setAccountsScope(e.target.value as any)}
                    disabled={loading || busy}
                    title="Cuentas a mostrar"
                  >
                    <option value="ACTIVE">Solo activas</option>
                    <option value="ALL">Todas</option>
                  </Select>

                  <Button
                    variant="secondary"
                    onClick={clearForm}
                    disabled={busy}
                    title="Limpiar"
                  >
                    <span className="inline-flex items-center gap-2">
                      <X className="h-4 w-4" />
                      Limpiar
                    </span>
                  </Button>
                </div>
              }
            />

            <CardBody>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Fecha (dateKey)">
                  <Input
                    type="date"
                    value={dateKey}
                    onChange={(e) => setDateKey(e.target.value)}
                    disabled={busy}
                  />
                </Field>

                <Field label="Monto">
                  <Input
                    inputMode="decimal"
                    placeholder="Ej: 200000"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    disabled={busy}
                  />
                  <div className="mt-1 text-xs text-zinc-500">
                    Preview:{" "}
                    <span className="font-semibold">{moneyARS(parsedAmount)}</span>
                  </div>
                </Field>

                <Field label="Cuenta origen">
                  <Select
                    value={fromAccountId}
                    onChange={(e) => setFromAccountId(e.target.value)}
                    disabled={busy || loading}
                  >
                    <option value="">Seleccionar…</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.type}){a.currency ? ` ${a.currency}` : ""}
                        {a.isActive === false ? " · INACTIVA" : ""}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field label="Cuenta destino">
                  <Select
                    value={toAccountId}
                    onChange={(e) => setToAccountId(e.target.value)}
                    disabled={busy || loading}
                  >
                    <option value="">Seleccionar…</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.type}){a.currency ? ` ${a.currency}` : ""}
                        {a.isActive === false ? " · INACTIVA" : ""}
                      </option>
                    ))}
                  </Select>
                </Field>

                <div className="md:col-span-2 flex flex-wrap items-center gap-2">
                  <Button
                    variant="secondary"
                    onClick={swapAccounts}
                    disabled={!fromAccountId || !toAccountId || busy}
                    title="Invertir origen/destino"
                  >
                    <span className="inline-flex items-center gap-2">
                      <Repeat2 className="h-4 w-4" />
                      Invertir
                    </span>
                  </Button>

                  {sameAccount && (
                    <span className="text-xs font-semibold text-amber-700">
                      Origen y destino no pueden ser iguales.
                    </span>
                  )}
                </div>

                <div className="md:col-span-2">
                  <Field label="Notas (opcional)">
                    <Input
                      placeholder="Ej: Depósito de caja al banco"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      disabled={busy}
                    />
                  </Field>
                </div>
              </div>

              {/* resumen */}
              <div className="mt-5 rounded-2xl border border-zinc-200 bg-white p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
                  <ArrowDownUp className="h-4 w-4" />
                  Resumen
                </div>

                <div className="mt-2 grid gap-2 text-sm text-zinc-700">
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-600">Origen</span>
                    <span className="font-semibold">
                      {fromAccountId ? accountLabelById.get(fromAccountId) ?? fromAccountId : "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-600">Destino</span>
                    <span className="font-semibold">
                      {toAccountId ? accountLabelById.get(toAccountId) ?? toAccountId : "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-600">Monto</span>
                    <span className="font-bold text-zinc-900">
                      {moneyARS(parsedAmount)}
                    </span>
                  </div>

                  {sameAccount && (
                    <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                      Origen y destino no pueden ser iguales.
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <Button onClick={createTransfer} disabled={!canSubmit} loading={busy}>
                  Registrar transferencia
                </Button>
              </div>

              <p className="mt-3 text-xs text-zinc-500">
                *Esto crea un movimiento <b>TRANSFER</b> en <code>/finance/movements</code>. No afecta neto,
                pero sí saldos por cuenta y el cierre del día.
              </p>
            </CardBody>
          </Card>

          {/* Ayuda rápida */}
          <Card>
            <CardHeader title="Tips" subtitle="Cosas a tener en cuenta" />
            <CardBody>
              <ul className="list-disc pl-5 text-sm text-zinc-700 space-y-1">
                <li>
                  Si el día está <b>LOCKED</b>, el backend te va a rechazar crear/modificar movimientos.
                </li>
                <li>
                  Usá transfer para “mover plata” entre cuentas (Caja → Banco, Banco → MP, etc.).
                </li>
                <li>
                  Para ingresos/gastos usá tus pantallas <code>/cashier/incomes</code> y{" "}
                  <code>/cashier/expenses</code>.
                </li>
              </ul>
            </CardBody>
          </Card>
        </div>
      </div>
    </AdminProtected>
  );
}
